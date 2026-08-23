export type NotificationType = 'request_accepted';
export type NotificationAudience = 'elderly' | 'caregiver';

export interface AppNotification {
  id: string;
  userId: string;
  audience: NotificationAudience;
  type: NotificationType;
  title: string;
  message: string;
  requestId?: string;
  volunteerId?: string;
  volunteerName?: string;
  volunteerVerified?: boolean;
  read: boolean;
  createdAt?: Date;
}

export interface AcceptanceNotificationContext {
  elderlyId: string;
  elderlyName?: string;
  caregiverId?: string;
  requestId: string;
  activityType: string;
  preferredDate: Date;
  preferredTime: string;
  volunteerId: string;
  volunteerName: string;
  volunteerVerified: boolean;
}

function whenLabel(date: Date, time: string): string {
  const day = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(date);
  return time ? `${day} at ${time}` : day;
}

/** Volunteer details the elderly user and caregiver may see: name, verification, and what was accepted. */
export function buildAcceptanceMessage(context: AcceptanceNotificationContext, audience: NotificationAudience): string {
  const verified = context.volunteerVerified ? ' (verified volunteer)' : '';
  const when = whenLabel(context.preferredDate, context.preferredTime);
  if (audience === 'caregiver') {
    const who = context.elderlyName ? `${context.elderlyName}'s` : 'Your linked family member\u2019s';
    return `${context.volunteerName}${verified} accepted ${who} ${context.activityType} request for ${when}.`;
  }
  return `${context.volunteerName}${verified} accepted your ${context.activityType} request. They will support you on ${when}.`;
}

export const ACCEPTANCE_NOTIFICATION_TITLE = 'Volunteer accepted your request';
export const ACCEPTANCE_NOTIFICATION_TITLE_CAREGIVER = 'A volunteer accepted a request';
