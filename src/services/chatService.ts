import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { hasAcceptedCaregiverLink } from './caregiverLinkService';
import { getRequestById, getRequestForVolunteer } from './requestService';
import { createChatMessageNotification } from './notificationService';
import { db } from './firebaseConfig';
import {
  canChatForStatus,
  type ChatParticipantRole,
  type RequestChat,
  type RequestChatMessage,
} from '../types/chat';
import type { CompanionshipRequest } from '../types/request';

function requireDb() {
  if (!db) throw new Error('Firebase is not configured.');
  return db;
}

function asDate(value: unknown): Date | undefined {
  return value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function'
    ? value.toDate()
    : undefined;
}

function asText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function chatRef(requestId: string) {
  return doc(requireDb(), 'requestChats', requestId);
}

function messageCollection(requestId: string) {
  return collection(chatRef(requestId), 'messages');
}

function fromChatSnapshot(data: DocumentData): RequestChat {
  return {
    requestId: asText(data.requestId) ?? '',
    elderlyUserId: asText(data.elderlyUserId) ?? '',
    caregiverId: asText(data.caregiverId) ?? '',
    volunteerId: asText(data.volunteerId) ?? '',
    createdAt: asDate(data.createdAt),
    updatedAt: asDate(data.updatedAt),
  };
}

function fromMessageSnapshot(snapshot: { id: string; data(): DocumentData }): RequestChatMessage {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    senderId: asText(data.senderId) ?? '',
    senderRole: data.senderRole === 'volunteer' ? 'volunteer' : 'caregiver',
    text: asText(data.text) ?? '',
    createdAt: asDate(data.createdAt),
    readBy: Array.isArray(data.readBy) ? data.readBy.filter((value): value is string => typeof value === 'string') : [],
  };
}

async function authorizedRequest(
  requestId: string,
  participantId: string,
  participantRole: ChatParticipantRole,
  elderlyUserId?: string,
): Promise<CompanionshipRequest> {
  if (participantRole === 'caregiver') {
    if (!elderlyUserId || !(await hasAcceptedCaregiverLink(participantId, elderlyUserId)))
      throw new Error('You need an accepted caregiver connection.');
    return getRequestById(requestId, elderlyUserId);
  }
  return getRequestForVolunteer(requestId, participantId);
}

export async function getRequestChat(
  requestId: string,
  participantId: string,
  participantRole: ChatParticipantRole,
  elderlyUserId?: string,
): Promise<{ request: CompanionshipRequest; chat: RequestChat | null; canSend: boolean }> {
  const request = await authorizedRequest(requestId, participantId, participantRole, elderlyUserId);
  const caregiverId = request.caregiverId;
  const volunteerId = request.assignedVolunteerId;
  if (!caregiverId || !volunteerId)
    return { request, chat: null, canSend: false };

  const snapshot = await getDoc(chatRef(requestId));
  const chat = snapshot.exists() ? fromChatSnapshot(snapshot.data()) : null;
  if (!chat && canChatForStatus(request.status)) {
    const created: RequestChat = {
      requestId,
      elderlyUserId: request.createdBy,
      caregiverId,
      volunteerId,
    };
    await setDoc(chatRef(requestId), {
      ...created,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return { request, chat: created, canSend: true };
  }
  return { request, chat, canSend: canChatForStatus(request.status) };
}

export function subscribeToRequestChat(
  requestId: string,
  onChange: (messages: RequestChatMessage[]) => void,
  onError: () => void = () => undefined,
): Unsubscribe {
  return onSnapshot(
    messageCollection(requestId),
    (snapshot) => onChange(
      snapshot.docs
        .map((item) => fromMessageSnapshot(item))
        .sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0)),
    ),
    onError,
  );
}

export async function sendRequestChatMessage({
  requestId,
  senderId,
  senderRole,
  elderlyUserId,
  text,
}: {
  requestId: string;
  senderId: string;
  senderRole: ChatParticipantRole;
  elderlyUserId?: string;
  text: string;
}) {
  const cleanText = text.trim();
  if (!cleanText) throw new Error('Message cannot be empty.');
  const request = await authorizedRequest(requestId, senderId, senderRole, elderlyUserId);
  if (!canChatForStatus(request.status) || !request.assignedVolunteerId || !request.caregiverId)
    throw new Error('This conversation is no longer active.');

  await setDoc(chatRef(requestId), {
    requestId,
    elderlyUserId: request.createdBy,
    caregiverId: request.caregiverId,
    volunteerId: request.assignedVolunteerId,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  const recipientId = senderRole === 'caregiver' ? request.assignedVolunteerId : request.caregiverId;
  const message = await addDoc(messageCollection(requestId), {
    senderId,
    senderRole,
    text: cleanText,
    readBy: [senderId],
    createdAt: serverTimestamp(),
  });
  await createChatMessageNotification({
    requestId,
    messageId: message.id,
    recipientId,
    senderId,
    senderRole,
    activityType: request.activityType,
  }).catch((cause) => console.warn('[chat] Message sent but notification could not be stored.', cause));
  return message.id;
}
