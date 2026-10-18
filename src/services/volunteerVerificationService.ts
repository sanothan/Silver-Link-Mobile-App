import { collection, doc, getDoc, getDocs, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { createVolunteerVerificationNotification } from './notificationService';
import type { UserProfile } from '../types/user';
import type {
  VolunteerVerificationDecisionInput,
  VolunteerVerificationRecord,
  VolunteerVerificationRow,
  VolunteerVerificationStatus,
} from '../types/volunteer';

/** Thrown when a caller without the admin role attempts a verification action. */
export class VolunteerVerificationAuthError extends Error {
  constructor(message = 'Only an administrator can verify volunteer profiles.') {
    super(message);
    this.name = 'VolunteerVerificationAuthError';
  }
}

const VERIFICATION_STATUSES: VolunteerVerificationStatus[] = ['verified', 'pending', 'rejected', 'unverified'];

function requireDb() {
  if (!db) throw new Error('Firebase is not configured.');
  return db;
}

function asText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asDate(value: unknown): Date | undefined {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  return undefined;
}

/**
 * Every verification action goes through this gate first. The Firestore rules
 * enforce the same restriction on the database side, so a normal user who
 * bypasses the UI still cannot approve anyone — this check exists to fail
 * early with a clear message rather than a raw permission error.
 */
export function assertCanVerifyVolunteers(actor: UserProfile | null | undefined): asserts actor is UserProfile {
  if (!actor || actor.role !== 'admin' || actor.status !== 'active') throw new VolunteerVerificationAuthError();
}

export function canVerifyVolunteers(actor: UserProfile | null | undefined): boolean {
  try {
    assertCanVerifyVolunteers(actor);
    return true;
  } catch {
    return false;
  }
}

/**
 * A volunteer's stored verification status wins; volunteers who registered
 * before the field existed fall back to their account status, where a pending
 * account means an application still waiting for review.
 */
export function resolveVerificationStatus(storedStatus: unknown, accountStatus: string): VolunteerVerificationStatus {
  const stored = asText(storedStatus)?.toLowerCase();
  if (stored && VERIFICATION_STATUSES.includes(stored as VolunteerVerificationStatus)) return stored as VolunteerVerificationStatus;
  return accountStatus === 'active' ? 'verified' : accountStatus === 'suspended' ? 'rejected' : 'pending';
}

/** Lists every volunteer with their current verification state, newest application first. */
export async function listVolunteerVerifications(actor: UserProfile | null | undefined): Promise<VolunteerVerificationRow[]> {
  assertCanVerifyVolunteers(actor);
  const database = requireDb();
  const userDocs = await getDocs(query(collection(database, 'users'), where('role', '==', 'volunteer')));

  const rows = await Promise.all(userDocs.docs.map(async (snapshot) => {
    const data = snapshot.data();
    const accountStatus = asText(data.status) ?? 'pending';
    let profileData: Record<string, unknown> | undefined;
    try {
      profileData = (await getDoc(doc(database, 'volunteerProfiles', snapshot.id))).data();
    } catch {
      profileData = undefined;
    }
    const row: VolunteerVerificationRow = {
      uid: snapshot.id,
      fullName: asText(data.fullName) ?? 'Unnamed volunteer',
      email: asText(data.email) ?? '',
      phone: asText(data.phone),
      locality: asText(data.locality),
      bio: asText(profileData?.bio),
      experience: asText(profileData?.experience),
      accountStatus,
      verificationStatus: resolveVerificationStatus(profileData?.verificationStatus, accountStatus),
      submittedAt: asDate(data.createdAt) ?? asDate(profileData?.createdAt),
      decidedAt: asDate(profileData?.verificationDecidedAt),
      decidedByName: asText(profileData?.verificationDecidedByName),
      decisionNote: asText(profileData?.verificationNote),
    };
    return row;
  }));

  return rows.sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0));
}

/**
 * Records an approve/reject decision. The volunteer profile, the account
 * status, and the audit entry are written in one batch so a decision is never
 * half-applied; the volunteer's notification follows once the write lands.
 */
export async function decideVolunteerVerification(
  actor: UserProfile | null | undefined,
  input: VolunteerVerificationDecisionInput,
): Promise<void> {
  assertCanVerifyVolunteers(actor);
  const database = requireDb();
  const approved = input.decision === 'approved';
  const note = input.note?.trim() || undefined;

  const batch = writeBatch(database);
  batch.set(doc(database, 'volunteerProfiles', input.volunteerId), {
    verificationStatus: approved ? 'verified' : 'rejected',
    verificationDecidedAt: serverTimestamp(),
    verificationDecidedBy: actor.uid,
    verificationDecidedByName: actor.fullName,
    verificationNote: note ?? null,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  batch.update(doc(database, 'users', input.volunteerId), {
    status: approved ? 'active' : 'suspended',
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(collection(database, 'volunteerVerifications')), {
    volunteerId: input.volunteerId,
    volunteerName: input.volunteerName,
    decision: input.decision,
    adminId: actor.uid,
    adminName: actor.fullName,
    note: note ?? null,
    decidedAt: serverTimestamp(),
  });
  await batch.commit();

  await createVolunteerVerificationNotification({
    volunteerId: input.volunteerId,
    volunteerName: input.volunteerName,
    decision: input.decision,
    note,
  });
}

export function approveVolunteerProfile(actor: UserProfile | null | undefined, volunteerId: string, volunteerName: string, note?: string) {
  return decideVolunteerVerification(actor, { volunteerId, volunteerName, decision: 'approved', note });
}

export function rejectVolunteerProfile(actor: UserProfile | null | undefined, volunteerId: string, volunteerName: string, note?: string) {
  return decideVolunteerVerification(actor, { volunteerId, volunteerName, decision: 'rejected', note });
}

/** The audit trail for one volunteer, most recent decision first. */
export async function getVolunteerVerificationHistory(
  actor: UserProfile | null | undefined,
  volunteerId: string,
): Promise<VolunteerVerificationRecord[]> {
  assertCanVerifyVolunteers(actor);
  const snapshot = await getDocs(query(collection(requireDb(), 'volunteerVerifications'), where('volunteerId', '==', volunteerId)));
  return snapshot.docs.map((item) => {
    const data = item.data() ?? {};
    const record: VolunteerVerificationRecord = {
      id: item.id,
      volunteerId: asText(data.volunteerId) ?? volunteerId,
      volunteerName: asText(data.volunteerName) ?? 'Unnamed volunteer',
      decision: data.decision === 'rejected' ? 'rejected' : 'approved',
      adminId: asText(data.adminId) ?? '',
      adminName: asText(data.adminName) ?? 'Administrator',
      note: asText(data.note),
      decidedAt: asDate(data.decidedAt),
    };
    return record;
  }).sort((a, b) => (b.decidedAt?.getTime() ?? 0) - (a.decidedAt?.getTime() ?? 0));
}
