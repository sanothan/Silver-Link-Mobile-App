import { timeToMinutes } from "./requestMatchingService";
import type { CompanionshipRequest } from "../types/request";
import type {
  ActivityReminderContext,
  NotificationAudience,
} from "../types/notification";

/**
 * How far ahead of the start time a reminder is generated. A day's notice is
 * long enough for an elderly participant to plan around the visit, and short
 * enough that the reminder still reads as "today or tomorrow".
 */
export const REMINDER_LEAD_MINUTES = 24 * 60;

export interface ActivityReminder {
  notificationId: string;
  userId: string;
  audience: NotificationAudience;
  context: ActivityReminderContext;
}

/** Combines the stored date and free-text time into a single start instant. */
export function activityStartsAt(request: CompanionshipRequest): Date | null {
  const minutes = timeToMinutes(request.preferredTime);
  if (minutes === null) return null;
  const start = new Date(request.preferredDate);
  start.setHours(0, 0, 0, 0);
  start.setMinutes(minutes);
  return start;
}

/**
 * Only a confirmed, still-upcoming visit earns a reminder. Cancelled — along
 * with completed, in-progress, and never-scheduled — activities are skipped,
 * which is what keeps a cancelled visit from ever reminding anyone.
 */
export function isReminderDue(
  request: CompanionshipRequest,
  now = new Date(),
): boolean {
  if (request.status !== "scheduled" || !request.assignedVolunteerId)
    return false;
  const start = activityStartsAt(request);
  if (!start) return false;
  const minutesUntilStart = (start.getTime() - now.getTime()) / 60000;
  return minutesUntilStart > 0 && minutesUntilStart <= REMINDER_LEAD_MINUTES;
}

/**
 * One stable id per request and recipient. Because the id never varies with
 * time, a second pass over the same activity addresses the same document
 * instead of stacking another reminder on the recipient's alerts.
 */
export function reminderNotificationId(
  requestId: string,
  audience: NotificationAudience,
  userId: string,
): string {
  return `${requestId}_activity_reminder_${audience}_${userId}`;
}

function reminderContext(
  request: CompanionshipRequest,
): ActivityReminderContext | null {
  if (!request.assignedVolunteerId) return null;
  return {
    elderlyId: request.createdBy,
    elderlyName: request.createdByName,
    caregiverId: request.caregiverId,
    requestId: request.id,
    activityType: request.activityType,
    preferredDate: request.preferredDate,
    preferredTime: request.preferredTime,
    volunteerId: request.assignedVolunteerId,
    volunteerName: request.volunteerName,
  };
}

/**
 * Everyone attached to the visit hears about it: the elderly participant, the
 * assigned volunteer, and the linked caregiver where one exists.
 */
export function reminderRecipients(
  context: ActivityReminderContext,
): { userId: string; audience: NotificationAudience }[] {
  const recipients: { userId: string; audience: NotificationAudience }[] = [
    { userId: context.elderlyId, audience: "elderly" },
    { userId: context.volunteerId, audience: "volunteer" },
  ];
  if (context.caregiverId && context.caregiverId !== context.elderlyId)
    recipients.push({ userId: context.caregiverId, audience: "caregiver" });
  return recipients;
}

/** The reminders a set of requests deserves right now, recipient by recipient. */
export function dueActivityReminders(
  requests: CompanionshipRequest[],
  now = new Date(),
): ActivityReminder[] {
  return requests
    .filter((request) => isReminderDue(request, now))
    .flatMap((request) => {
      const context = reminderContext(request);
      if (!context) return [];
      return reminderRecipients(context).map(({ userId, audience }) => ({
        notificationId: reminderNotificationId(request.id, audience, userId),
        userId,
        audience,
        context,
      }));
    });
}
