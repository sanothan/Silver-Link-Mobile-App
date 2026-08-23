import { collection, doc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc, where, writeBatch, type DocumentData } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { ACCEPTANCE_NOTIFICATION_TITLE, ACCEPTANCE_NOTIFICATION_TITLE_CAREGIVER, buildAcceptanceMessage, type AcceptanceNotificationContext, type AppNotification, type NotificationAudience } from '../types/notification';

function requireDb() { if (!db) throw new Error('Firebase is not configured.'); return db; }
function asDate(value: unknown): Date | undefined { return value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function' ? value.toDate() : undefined; }
function asText(value: unknown): string | undefined { return typeof value === 'string' && value.trim() ? value.trim() : undefined; }

function fromSnapshot(snapshot: { id: string; data(): DocumentData | undefined }): AppNotification {
  const data = snapshot.data() ?? {};
  return { id: snapshot.id, userId: asText(data.userId) ?? '', audience: data.audience === 'caregiver' ? 'caregiver' : 'elderly', type: 'request_accepted', title: asText(data.title) ?? ACCEPTANCE_NOTIFICATION_TITLE, message: asText(data.message) ?? '', requestId: asText(data.requestId), volunteerId: asText(data.volunteerId), volunteerName: asText(data.volunteerName), volunteerVerified: data.volunteerVerified === true, read: data.read === true, createdAt: asDate(data.createdAt) };
}

function notificationPayload(context: AcceptanceNotificationContext, userId: string, audience: NotificationAudience) {
  return {
    userId,
    audience,
    type: 'request_accepted' as const,
    title: audience === 'caregiver' ? ACCEPTANCE_NOTIFICATION_TITLE_CAREGIVER : ACCEPTANCE_NOTIFICATION_TITLE,
    message: buildAcceptanceMessage(context, audience),
    requestId: context.requestId,
    volunteerId: context.volunteerId,
    volunteerName: context.volunteerName,
    volunteerVerified: context.volunteerVerified,
    read: false,
    createdAt: serverTimestamp(),
  };
}

/**
 * Stores an acceptance notification for the elderly user and, when the request
 * owner has one linked, for their caregiver as well. Both are written in one
 * batch so a caregiver never gets an alert the elderly user is missing.
 */
export async function createAcceptanceNotifications(context: AcceptanceNotificationContext) {
  const database = requireDb();
  const notifications = collection(database, 'notifications');
  const batch = writeBatch(database);
  batch.set(doc(notifications), notificationPayload(context, context.elderlyId, 'elderly'));
  if (context.caregiverId && context.caregiverId !== context.elderlyId) {
    batch.set(doc(notifications), notificationPayload(context, context.caregiverId, 'caregiver'));
  }
  await batch.commit();
}

export async function getNotifications(uid: string, max = 30): Promise<AppNotification[]> {
  const snapshot = await getDocs(query(collection(requireDb(), 'notifications'), where('userId', '==', uid), orderBy('createdAt', 'desc'), limit(max)));
  return snapshot.docs.map(fromSnapshot);
}

export async function getUnreadNotificationCount(uid: string): Promise<number> {
  const items = await getNotifications(uid);
  return items.filter((item) => !item.read).length;
}

export async function markNotificationRead(notificationId: string) {
  await updateDoc(doc(requireDb(), 'notifications', notificationId), { read: true, readAt: serverTimestamp() });
}
