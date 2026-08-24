import type { RequestStatus } from "./request";

export type NotificationType =
  | "request_accepted"
  | "request_scheduled"
  | "request_started"
  | "request_completed"
  | "request_cancelled";
export type NotificationAudience = "elderly" | "caregiver" | "volunteer";

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

export type NotifiableRequestStatus = Exclude<RequestStatus, "pending">;
export interface StatusNotificationContext {
  elderlyId: string;
  requestId: string;
  activityType: string;
  status: NotifiableRequestStatus;
  preferredDate: Date;
  preferredTime: string;
  volunteerId?: string;
}

export interface ScheduleConfirmationContext {
  elderlyId: string;
  elderlyName?: string;
  caregiverId?: string;
  requestId: string;
  activityType: string;
  preferredDate: Date;
  preferredTime: string;
  volunteerId: string;
  volunteerName: string;
}

function whenLabel(date: Date, time: string): string {
  const day = new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
  }).format(date);
  return time ? `${day} at ${time}` : day;
}

export function buildAcceptanceMessage(
  context: AcceptanceNotificationContext,
  audience: NotificationAudience,
): string {
  const verified = context.volunteerVerified ? " (verified volunteer)" : "";
  const when = whenLabel(context.preferredDate, context.preferredTime);
  if (audience === "caregiver") {
    const who = context.elderlyName
      ? `${context.elderlyName}'s`
      : "Your linked family member’s";
    return `${context.volunteerName}${verified} accepted ${who} ${context.activityType} request for ${when}.`;
  }
  if (audience === "volunteer")
    return `You accepted a ${context.activityType} request for ${when}.`;
  return `${context.volunteerName}${verified} accepted your ${context.activityType} request. They will support you on ${when}.`;
}

export const ACCEPTANCE_NOTIFICATION_TITLE = "Volunteer Found";
export const ACCEPTANCE_NOTIFICATION_TITLE_CAREGIVER = "Volunteer Found";
export const ACCEPTANCE_NOTIFICATION_TITLE_VOLUNTEER = "Request Accepted";
export const SCHEDULE_CONFIRMATION_TITLE = "Visit Scheduled";

export function buildScheduleConfirmationMessage(
  context: ScheduleConfirmationContext,
  audience: NotificationAudience,
): string {
  const when = whenLabel(context.preferredDate, context.preferredTime);
  if (audience === "caregiver") {
    const who = context.elderlyName
      ? `${context.elderlyName}'s`
      : "Your linked family member’s";
    return `${who} ${context.activityType} visit with ${context.volunteerName} has been scheduled for ${when}.`;
  }
  if (audience === "volunteer")
    return `Your ${context.activityType} visit is confirmed for ${when}.`;
  return `Your visit with ${context.volunteerName} has been scheduled for ${when}.`;
}

export function notificationTypeForStatus(
  status: NotifiableRequestStatus,
): NotificationType {
  return status === "accepted"
    ? "request_accepted"
    : status === "scheduled"
      ? "request_scheduled"
      : status === "in_progress"
        ? "request_started"
        : status === "completed"
          ? "request_completed"
          : "request_cancelled";
}

export function buildStatusNotificationContent(
  context: StatusNotificationContext,
): { title: string; message: string } {
  switch (context.status) {
    case "accepted":
      return {
        title: "Volunteer Found",
        message: `A volunteer has accepted your ${context.activityType} request.`,
      };
    case "scheduled":
      return {
        title: "Visit Scheduled",
        message: `Your visit has been scheduled for ${whenLabel(context.preferredDate, context.preferredTime)}.`,
      };
    case "in_progress":
      return {
        title: "Visit Started",
        message: "Your companionship visit is now in progress.",
      };
    case "completed":
      return {
        title: "Visit Completed",
        message: "Your companionship visit has been completed.",
      };
    case "cancelled":
      return {
        title: "Request Cancelled",
        message: `Your ${context.activityType} request has been cancelled.`,
      };
  }
}
