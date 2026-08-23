import { collection, doc, getDoc, getDocs, limit, orderBy, query, where, type DocumentData, type QueryDocumentSnapshot, type QuerySnapshot } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { getVolunteerAvailability } from './volunteerAvailabilityService';
import type { VolunteerActivity, VolunteerActivityStatus, VolunteerDashboardData, VolunteerImpact, VolunteerOpportunity, VolunteerUpdate, VolunteerVerificationStatus } from '../types/volunteer';

const OPEN_REQUEST_STATUSES = ['pending', 'open', 'available'];
const ACTIVE_ACTIVITY_STATUSES: VolunteerActivityStatus[] = ['accepted', 'scheduled', 'ready_to_start', 'in_progress'];

function asDate(value: unknown): Date | undefined {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  return undefined;
}

function asText(value: unknown): string | undefined { return typeof value === 'string' && value.trim() ? value.trim() : undefined; }
function asNumber(value: unknown): number | undefined { return typeof value === 'number' && Number.isFinite(value) ? value : undefined; }

function opportunityFromSnapshot(snapshot: QueryDocumentSnapshot<DocumentData>): VolunteerOpportunity {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    activityType: asText(data.activityType) || asText(data.category) || 'Community support',
    scheduledAt: asDate(data.scheduledAt) || asDate(data.dateTime),
    durationMinutes: asNumber(data.durationMinutes) || asNumber(data.duration),
    generalLocation: asText(data.generalLocation) || asText(data.area) || asText(data.locationSummary),
    helpDescription: asText(data.helpDescription) || asText(data.description),
    status: asText(data.status) || 'available',
  };
}

async function safely<T>(operation: () => Promise<T>, fallback: T): Promise<T> { try { return await operation(); } catch { return fallback; } }
async function safelyDocs(operation: () => Promise<QuerySnapshot<DocumentData>>): Promise<QueryDocumentSnapshot<DocumentData>[]> { try { return (await operation()).docs; } catch { return []; } }

export async function getVolunteerDashboard(uid: string, userStatus?: string): Promise<VolunteerDashboardData> {
  if (!db) throw new Error('Firebase is not configured.');
  const [profileSnapshot, statsSnapshot, availabilityEntries, opportunitySnapshots, assignmentSnapshots, notificationSnapshots] = await Promise.all([
    safely(() => getDoc(doc(db!, 'volunteerProfiles', uid)), null),
    safely(() => getDoc(doc(db!, 'volunteerStats', uid)), null),
    safely(() => getVolunteerAvailability(uid), []),
    safelyDocs(() => getDocs(query(collection(db!, 'requests'), where('status', 'in', OPEN_REQUEST_STATUSES), limit(3)))),
    safelyDocs(() => getDocs(query(collection(db!, 'requestAssignments'), where('volunteerId', '==', uid), limit(10)))),
    safelyDocs(() => getDocs(query(collection(db!, 'notifications'), where('userId', '==', uid), orderBy('createdAt', 'desc'), limit(3)))),
  ]);

  const profileData = profileSnapshot?.data();
  const rawVerification = asText(profileData?.verificationStatus)?.toLowerCase();
  const verificationStatus: VolunteerVerificationStatus = rawVerification === 'verified' || rawVerification === 'pending' || rawVerification === 'rejected' ? rawVerification : userStatus === 'active' ? 'unverified' : 'pending';
  const statsData = statsSnapshot?.data();
  const impact: VolunteerImpact | null = statsData ? { completedActivities: asNumber(statsData.completedActivities), volunteerHours: asNumber(statsData.volunteerHours), peopleSupported: asNumber(statsData.peopleSupported) } : null;
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const availability = availabilityEntries.find((item) => item.isAvailable && item.date >= startOfToday) ?? null;
  const opportunities = opportunitySnapshots.map(opportunityFromSnapshot);
  const activities = assignmentSnapshots.map((snapshot) => {
    const data = snapshot.data();
    const status = asText(data.status)?.toLowerCase().replace(/\s+/g, '_') as VolunteerActivityStatus | undefined;
    if (!status || !ACTIVE_ACTIVITY_STATUSES.includes(status)) return null;
    return { ...opportunityFromSnapshot(snapshot), status } as VolunteerActivity;
  }).filter((item): item is VolunteerActivity => item !== null).sort((a, b) => (a.scheduledAt?.getTime() ?? Infinity) - (b.scheduledAt?.getTime() ?? Infinity));
  const updates: VolunteerUpdate[] = notificationSnapshots.map((snapshot) => {
    const data = snapshot.data();
    return { id: snapshot.id, message: asText(data.message) || asText(data.title) || 'Volunteer activity update', createdAt: asDate(data.createdAt) };
  });

  return { verificationStatus, impact, opportunities, nextActivity: activities[0] ?? null, availability, updates };
}
