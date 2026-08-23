import { addDoc, collection, doc, getDoc, getDocs, limit, query, runTransaction, serverTimestamp, Timestamp, updateDoc, where, type DocumentData } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { createAcceptanceNotifications } from './notificationService';
import { getUserProfile } from './userService';
import type { CompanionshipRequest, RequestFormValues, RequestStatus } from '../types/request';

function requireDb() { if (!db) throw new Error('Firebase is not configured.'); return db; }
function asDate(value: unknown): Date | undefined { return value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function' ? value.toDate() : undefined; }
function asText(value: unknown): string | undefined { return typeof value === 'string' && value.trim() ? value.trim() : undefined; }
const STATUSES: RequestStatus[] = ['pending', 'accepted', 'scheduled', 'in_progress', 'completed', 'cancelled'];

function fromSnapshot(snapshot: { id: string; data(): DocumentData | undefined }): CompanionshipRequest {
  const data = snapshot.data();
  if (!data) throw new Error('Request not found.');
  const status = STATUSES.includes(data.status) ? data.status : 'pending';
  return { id: snapshot.id, createdBy: asText(data.createdBy) ?? '', createdByName: asText(data.createdByName), caregiverId: asText(data.caregiverId), activityType: asText(data.activityType) ?? 'Community support', description: asText(data.description), preferredDate: asDate(data.preferredDate) ?? asDate(data.scheduledAt) ?? new Date(), preferredTime: asText(data.preferredTime) ?? '', durationMinutes: typeof data.durationMinutes === 'number' ? data.durationMinutes : undefined, durationLabel: asText(data.durationLabel), location: asText(data.location) ?? asText(data.generalLocation) ?? '', status, assignedVolunteerId: asText(data.assignedVolunteerId), volunteerName: asText(data.volunteerName), volunteerVerified: data.volunteerVerified === true, createdAt: asDate(data.createdAt), updatedAt: asDate(data.updatedAt) };
}

export async function createRequest(uid: string, values: RequestFormValues) {
  const database = requireDb();
  const owner = await getUserProfile(uid).catch(() => null);
  // Denormalised so an accepting volunteer can notify the right people without
  // needing read access to the elderly user's profile.
  const result = await addDoc(collection(database, 'requests'), { createdBy: uid, createdByName: owner?.fullName ?? null, caregiverId: owner?.caregiverId ?? null, activityType: values.activityType, description: values.description?.trim() || null, preferredDate: Timestamp.fromDate(values.preferredDate), preferredTime: values.preferredTime, durationMinutes: values.durationMinutes ?? null, durationLabel: values.durationLabel ?? null, location: values.location.trim(), status: 'pending', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return result.id;
}

export async function getElderlyRequests(uid: string) {
  const database = requireDb();
  const snapshot = await getDocs(query(collection(database, 'requests'), where('createdBy', '==', uid)));
  return snapshot.docs.map(fromSnapshot).sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
}

export async function getRequestById(requestId: string, uid: string) {
  const snapshot = await getDoc(doc(requireDb(), 'requests', requestId));
  if (!snapshot.exists()) throw new Error('Request not found.');
  const request = fromSnapshot(snapshot);
  if (request.createdBy !== uid) throw new Error('You cannot access this request.');
  return request;
}

export async function updateRequest(requestId: string, uid: string, values: RequestFormValues) {
  const current = await getRequestById(requestId, uid);
  if (!['pending', 'accepted'].includes(current.status)) throw new Error('This request can no longer be edited.');
  await updateDoc(doc(requireDb(), 'requests', requestId), { activityType: values.activityType, description: values.description?.trim() || null, preferredDate: Timestamp.fromDate(values.preferredDate), preferredTime: values.preferredTime, durationMinutes: values.durationMinutes ?? null, durationLabel: values.durationLabel ?? null, location: values.location.trim(), updatedAt: serverTimestamp() });
}

export async function cancelRequest(requestId: string, uid: string) {
  const database = requireDb();
  const current = await getRequestById(requestId, uid);
  if (!['pending', 'accepted', 'scheduled'].includes(current.status)) throw new Error('This request can no longer be cancelled.');
  await updateDoc(doc(database, 'requests', requestId), { status: 'cancelled', cancelledAt: serverTimestamp(), cancelledBy: uid, updatedAt: serverTimestamp() });
  // Keep the assignment record in step so a volunteer's dashboard and the
  // admin dashboard (both of which read requestAssignments.status) don't keep
  // showing a cancelled request as an active activity. Swallowed because an
  // assignment written before this doc-id-per-request convention may not
  // exist at this id; the request itself is still the source of truth.
  if (current.assignedVolunteerId) {
    await updateDoc(doc(database, 'requestAssignments', requestId), { status: 'cancelled', updatedAt: serverTimestamp() }).catch(() => undefined);
  }
}

export async function getOpenRequests(max = 20): Promise<CompanionshipRequest[]> {
  const database = requireDb();
  const snapshot = await getDocs(query(collection(database, 'requests'), where('status', '==', 'pending'), limit(max)));
  return snapshot.docs.map(fromSnapshot).sort((a, b) => a.preferredDate.getTime() - b.preferredDate.getTime());
}

export interface AcceptingVolunteer { uid: string; fullName: string; verified: boolean }

export type AcceptanceFailure = 'not-a-volunteer' | 'not-found' | 'already-accepted' | 'unavailable' | 'own-request';

const ACCEPTANCE_MESSAGES: Record<AcceptanceFailure, string> = {
  'not-a-volunteer': 'Only an approved volunteer account can accept companionship requests.',
  'not-found': 'This request no longer exists.',
  'already-accepted': 'This request has already been accepted by another volunteer.',
  unavailable: 'This request is no longer available.',
  'own-request': 'You cannot accept a request that you created yourself.',
};

/** Carries a machine-readable reason so screens can react without matching on message text. */
export class RequestAcceptanceError extends Error {
  constructor(public readonly reason: AcceptanceFailure) {
    super(ACCEPTANCE_MESSAGES[reason]);
    this.name = 'RequestAcceptanceError';
  }
}

/** The assignment id *is* the request id, so the database can only ever hold one assignment per request. */
function assignmentRef(database: ReturnType<typeof requireDb>, requestId: string) { return doc(database, 'requestAssignments', requestId); }

/**
 * Claims a pending request for a volunteer, records the assignment, and tells
 * the elderly user (and their linked caregiver) that support is arranged.
 *
 * The status check and both writes run inside a Firestore transaction. If two
 * volunteers race, the server aborts whichever commit lost, the SDK re-runs
 * this callback, the second read now sees 'accepted', and that volunteer is
 * turned away — so only one assignment can ever exist. The role and status are
 * read from the caller's own profile rather than trusted from the screen.
 */
export async function acceptRequest(requestId: string, volunteerUid: string): Promise<CompanionshipRequest> {
  const database = requireDb();
  const profile = await getUserProfile(volunteerUid).catch(() => null);
  if (!profile || profile.role !== 'volunteer' || profile.status === 'suspended') throw new RequestAcceptanceError('not-a-volunteer');
  const volunteer: AcceptingVolunteer = { uid: profile.uid, fullName: profile.fullName.trim() || 'A SilverLink volunteer', verified: profile.status === 'active' };

  const requestRef = doc(database, 'requests', requestId);
  const assignment = assignmentRef(database, requestId);

  const request = await runTransaction(database, async (transaction) => {
    // Every read must happen before the first write in a Firestore transaction.
    const snapshot = await transaction.get(requestRef);
    if (!snapshot.exists()) throw new RequestAcceptanceError('not-found');
    const current = fromSnapshot(snapshot);
    const existingAssignment = await transaction.get(assignment);

    if (current.createdBy === volunteer.uid) throw new RequestAcceptanceError('own-request');
    if (current.assignedVolunteerId || existingAssignment.exists()) throw new RequestAcceptanceError('already-accepted');
    if (current.status !== 'pending') throw new RequestAcceptanceError(current.status === 'accepted' ? 'already-accepted' : 'unavailable');

    transaction.update(requestRef, { status: 'accepted', assignedVolunteerId: volunteer.uid, volunteerName: volunteer.fullName, volunteerVerified: volunteer.verified, acceptedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    transaction.set(assignment, { requestId, volunteerId: volunteer.uid, activityType: current.activityType, scheduledAt: Timestamp.fromDate(current.preferredDate), durationMinutes: current.durationMinutes ?? null, generalLocation: current.location, status: 'accepted', createdAt: serverTimestamp() });
    return current;
  });

  try {
    await createAcceptanceNotifications({
      elderlyId: request.createdBy,
      elderlyName: request.createdByName,
      caregiverId: request.caregiverId,
      requestId,
      activityType: request.activityType,
      preferredDate: request.preferredDate,
      preferredTime: request.preferredTime,
      volunteerId: volunteer.uid,
      volunteerName: volunteer.fullName,
      volunteerVerified: volunteer.verified,
    });
  } catch (cause) {
    // The acceptance is already committed. Failing here would tell the volunteer
    // their acceptance did not go through, and a retry would then be rejected as
    // a duplicate — so the alert is dropped rather than the assignment.
    console.warn('[requests] Request accepted but the acceptance notification could not be stored.', cause);
  }
  return { ...request, status: 'accepted', assignedVolunteerId: volunteer.uid, volunteerName: volunteer.fullName, volunteerVerified: volunteer.verified };
}

/** Requests this volunteer has claimed — the source for the My Activities screen. */
export async function getVolunteerRequests(volunteerUid: string): Promise<CompanionshipRequest[]> {
  const snapshot = await getDocs(query(collection(requireDb(), 'requests'), where('assignedVolunteerId', '==', volunteerUid)));
  return snapshot.docs.map(fromSnapshot).sort((a, b) => a.preferredDate.getTime() - b.preferredDate.getTime());
}

/** A single request, scoped to the volunteer assigned to it — for the volunteer's request-details view. */
export async function getRequestForVolunteer(requestId: string, volunteerUid: string): Promise<CompanionshipRequest> {
  const snapshot = await getDoc(doc(requireDb(), 'requests', requestId));
  if (!snapshot.exists()) throw new Error('Request not found.');
  const request = fromSnapshot(snapshot);
  if (request.assignedVolunteerId !== volunteerUid) throw new Error('This request is not assigned to you.');
  return request;
}