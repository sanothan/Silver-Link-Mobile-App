import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, Timestamp, updateDoc, where, type DocumentData } from 'firebase/firestore';
import { db } from './firebaseConfig';
import type { CompanionshipRequest, RequestFormValues, RequestStatus } from '../types/request';

function requireDb() { if (!db) throw new Error('Firebase is not configured.'); return db; }
function asDate(value: unknown): Date | undefined { return value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function' ? value.toDate() : undefined; }
function asText(value: unknown): string | undefined { return typeof value === 'string' && value.trim() ? value.trim() : undefined; }
const STATUSES: RequestStatus[] = ['pending', 'accepted', 'scheduled', 'in_progress', 'completed', 'cancelled'];

function fromSnapshot(snapshot: { id: string; data(): DocumentData | undefined }): CompanionshipRequest {
  const data = snapshot.data();
  if (!data) throw new Error('Request not found.');
  const status = STATUSES.includes(data.status) ? data.status : 'pending';
  return { id: snapshot.id, createdBy: asText(data.createdBy) ?? '', activityType: asText(data.activityType) ?? 'Community support', description: asText(data.description), preferredDate: asDate(data.preferredDate) ?? asDate(data.scheduledAt) ?? new Date(), preferredTime: asText(data.preferredTime) ?? '', durationMinutes: typeof data.durationMinutes === 'number' ? data.durationMinutes : undefined, durationLabel: asText(data.durationLabel), location: asText(data.location) ?? asText(data.generalLocation) ?? '', status, assignedVolunteerId: asText(data.assignedVolunteerId), volunteerName: asText(data.volunteerName), volunteerVerified: data.volunteerVerified === true, createdAt: asDate(data.createdAt), updatedAt: asDate(data.updatedAt) };
}

export async function createRequest(uid: string, values: RequestFormValues) {
  const database = requireDb();
  const result = await addDoc(collection(database, 'requests'), { createdBy: uid, activityType: values.activityType, description: values.description?.trim() || null, preferredDate: Timestamp.fromDate(values.preferredDate), preferredTime: values.preferredTime, durationMinutes: values.durationMinutes ?? null, durationLabel: values.durationLabel ?? null, location: values.location.trim(), status: 'pending', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
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
  const current = await getRequestById(requestId, uid);
  if (!['pending', 'accepted', 'scheduled'].includes(current.status)) throw new Error('This request can no longer be cancelled.');
  await updateDoc(doc(requireDb(), 'requests', requestId), { status: 'cancelled', cancelledAt: serverTimestamp(), cancelledBy: uid, updatedAt: serverTimestamp() });
}
