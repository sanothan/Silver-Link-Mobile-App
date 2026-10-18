import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, Timestamp, updateDoc, where, type DocumentData, type DocumentReference } from 'firebase/firestore';
import { db } from './firebaseConfig';
import type { CreateAvailabilityData, UpdateAvailabilityData, VolunteerAvailability } from '../types/volunteer';
import { overlapsAvailability } from './volunteerAvailabilityValidation';

function requireDb() { if (!db) throw new Error('Firebase is not configured.'); return db; }
function asDate(value: unknown): Date | undefined { return value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function' ? value.toDate() : undefined; }
function asText(value: unknown): string | undefined { return typeof value === 'string' && value.trim() ? value.trim() : undefined; }
function availabilityCollection() { return collection(requireDb(), 'volunteerAvailability'); }
function legacyCollection(volunteerId: string) { return collection(requireDb(), 'volunteerAvailability', volunteerId, 'entries'); }

function fromSnapshot(snapshot: { id: string; data(): DocumentData | undefined }): VolunteerAvailability {
  const data = snapshot.data();
  if (!data) throw new Error('Availability not found.');
  const date = asDate(data.date);
  if (!date) throw new Error('Availability has an invalid date.');
  return { id: snapshot.id, volunteerId: asText(data.volunteerId) ?? '', date, startTime: asText(data.startTime) ?? '', endTime: asText(data.endTime) ?? '', isAvailable: data.isAvailable !== false, preferredActivityTypes: Array.isArray(data.preferredActivityTypes) ? data.preferredActivityTypes.filter((item): item is string => typeof item === 'string') : undefined, preferredDuration: asText(data.preferredDuration) ?? null, createdAt: asDate(data.createdAt), updatedAt: asDate(data.updatedAt) };
}

function cleanValues(values: CreateAvailabilityData) { return { date: Timestamp.fromDate(values.date), startTime: values.startTime, endTime: values.endTime, preferredActivityTypes: values.preferredActivityTypes?.length ? values.preferredActivityTypes : null, preferredDuration: values.preferredDuration || null }; }

async function getOwnedReference(volunteerId: string, availabilityId: string): Promise<DocumentReference<DocumentData>> {
  const database = requireDb();
  const standardRef = doc(database, 'volunteerAvailability', availabilityId);
  const standard = await getDoc(standardRef);
  if (standard.exists() && standard.data().volunteerId === volunteerId) return standardRef;

  // Compatibility for availability created before the collection layout was corrected.
  const legacyRef = doc(database, 'volunteerAvailability', volunteerId, 'entries', availabilityId);
  const legacy = await getDoc(legacyRef);
  if (legacy.exists() && legacy.data().volunteerId === volunteerId) return legacyRef;
  throw new Error('Availability not found.');
}

export async function createAvailability(volunteerId: string, values: CreateAvailabilityData): Promise<string> {
  if (overlapsAvailability(values, await getVolunteerAvailability(volunteerId))) throw new AvailabilityOverlapError();
  const result = await addDoc(availabilityCollection(), { volunteerId, ...cleanValues(values), isAvailable: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return result.id;
}

export async function getVolunteerAvailability(volunteerId: string): Promise<VolunteerAvailability[]> {
  const results = await Promise.allSettled([
    getDocs(query(availabilityCollection(), where('volunteerId', '==', volunteerId))),
    getDocs(query(legacyCollection(volunteerId), where('volunteerId', '==', volunteerId))),
  ]);
  if (results.every((result) => result.status === 'rejected')) throw new Error('Availability could not be loaded.');
  const records = results.flatMap((result) => result.status === 'fulfilled' ? result.value.docs.map(fromSnapshot) : []);
  return records.sort((a, b) => a.date.getTime() - b.date.getTime() || a.startTime.localeCompare(b.startTime));
}

export async function getAvailabilityById(volunteerId: string, availabilityId: string): Promise<VolunteerAvailability> {
  const snapshot = await getDoc(await getOwnedReference(volunteerId, availabilityId));
  return fromSnapshot(snapshot);
}

export async function updateAvailability(volunteerId: string, availabilityId: string, values: UpdateAvailabilityData): Promise<void> {
  if (overlapsAvailability(values, await getVolunteerAvailability(volunteerId), availabilityId)) throw new AvailabilityOverlapError();
  await updateDoc(await getOwnedReference(volunteerId, availabilityId), { ...cleanValues(values), updatedAt: serverTimestamp() });
}

export class AvailabilityOverlapError extends Error {
  constructor() { super('This time overlaps with another availability you already added.'); this.name = 'AvailabilityOverlapError'; }
}

// We retain a record rather than hard-deleting it, preserving matching/audit history.
export async function removeAvailability(volunteerId: string, availabilityId: string): Promise<void> {
  await updateDoc(await getOwnedReference(volunteerId, availabilityId), { isAvailable: false, updatedAt: serverTimestamp() });
}
