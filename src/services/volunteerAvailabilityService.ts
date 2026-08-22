import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, Timestamp, updateDoc, where, type DocumentData } from 'firebase/firestore';
import { db } from './firebaseConfig';
import type { CreateAvailabilityData, UpdateAvailabilityData, VolunteerAvailability } from '../types/volunteer';

function requireDb() { if (!db) throw new Error('Firebase is not configured.'); return db; }
function asDate(value: unknown): Date | undefined { return value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function' ? value.toDate() : undefined; }
function asText(value: unknown): string | undefined { return typeof value === 'string' && value.trim() ? value.trim() : undefined; }

function entryCollection(volunteerId: string) { return collection(requireDb(), 'volunteerAvailability', volunteerId, 'entries'); }

function fromSnapshot(snapshot: { id: string; data(): DocumentData | undefined }): VolunteerAvailability {
  const data = snapshot.data();
  if (!data) throw new Error('Availability not found.');
  const date = asDate(data.date);
  if (!date) throw new Error('Availability has an invalid date.');
  return {
    id: snapshot.id,
    volunteerId: asText(data.volunteerId) ?? '',
    date,
    startTime: asText(data.startTime) ?? '',
    endTime: asText(data.endTime) ?? '',
    isAvailable: data.isAvailable !== false,
    preferredActivityTypes: Array.isArray(data.preferredActivityTypes) ? data.preferredActivityTypes.filter((item): item is string => typeof item === 'string') : undefined,
    preferredDuration: asText(data.preferredDuration) ?? null,
    createdAt: asDate(data.createdAt),
    updatedAt: asDate(data.updatedAt),
  };
}

function cleanValues(values: CreateAvailabilityData) {
  return {
    date: Timestamp.fromDate(values.date),
    startTime: values.startTime,
    endTime: values.endTime,
    preferredActivityTypes: values.preferredActivityTypes?.length ? values.preferredActivityTypes : null,
    preferredDuration: values.preferredDuration || null,
  };
}

export async function createAvailability(volunteerId: string, values: CreateAvailabilityData): Promise<string> {
  const result = await addDoc(entryCollection(volunteerId), { volunteerId, ...cleanValues(values), isAvailable: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return result.id;
}

export async function getVolunteerAvailability(volunteerId: string): Promise<VolunteerAvailability[]> {
  const snapshot = await getDocs(query(entryCollection(volunteerId), where('volunteerId', '==', volunteerId)));
  return snapshot.docs.map(fromSnapshot).sort((a, b) => a.date.getTime() - b.date.getTime() || a.startTime.localeCompare(b.startTime));
}

export async function getAvailabilityById(volunteerId: string, availabilityId: string): Promise<VolunteerAvailability> {
  const snapshot = await getDoc(doc(entryCollection(volunteerId), availabilityId));
  if (!snapshot.exists()) throw new Error('Availability not found.');
  const availability = fromSnapshot(snapshot);
  if (availability.volunteerId !== volunteerId) throw new Error('You cannot access this availability.');
  return availability;
}

export async function updateAvailability(volunteerId: string, availabilityId: string, values: UpdateAvailabilityData): Promise<void> {
  await getAvailabilityById(volunteerId, availabilityId);
  await updateDoc(doc(entryCollection(volunteerId), availabilityId), { ...cleanValues(values), updatedAt: serverTimestamp() });
}

// We retain a record rather than hard-deleting it, preserving matching/audit history.
export async function removeAvailability(volunteerId: string, availabilityId: string): Promise<void> {
  await getAvailabilityById(volunteerId, availabilityId);
  await updateDoc(doc(entryCollection(volunteerId), availabilityId), { isAvailable: false, updatedAt: serverTimestamp() });
}
