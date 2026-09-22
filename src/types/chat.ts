import type { RequestStatus } from './request';

export type ChatParticipantRole = 'caregiver' | 'volunteer';

export const ACTIVE_CHAT_STATUSES: RequestStatus[] = [
  'accepted',
  'scheduled',
  'in_progress',
];

export function canChatForStatus(status: RequestStatus) {
  return ACTIVE_CHAT_STATUSES.includes(status);
}

export interface RequestChat {
  requestId: string;
  elderlyUserId: string;
  caregiverId: string;
  volunteerId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RequestChatMessage {
  id: string;
  senderId: string;
  senderRole: ChatParticipantRole;
  text: string;
  createdAt?: Date;
  readBy: string[];
}
