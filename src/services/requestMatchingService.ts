import type { CompanionshipRequest } from '../types/request';
import { normalizeActivityTypes } from '../types/request';
import type { VolunteerAvailability } from '../types/volunteer';

export function doesRequestMatchActivityInterest(
  request: CompanionshipRequest,
  volunteerInterests: readonly string[],
): boolean {
  if (request.status !== 'pending' || request.assignedVolunteerId) return false;
  const [activity] = normalizeActivityTypes([request.activityType]);
  return !!activity && normalizeActivityTypes(volunteerInterests).includes(activity);
}

/** Stable ranking: both, interest only, availability only, then other requests. */
export function rankRequestsByMatch(
  requests: CompanionshipRequest[], interests: readonly string[], availabilityIds: ReadonlySet<string>,
): { request: CompanionshipRequest; interestMatch: boolean; availabilityMatch: boolean }[] {
  const unique = new Map(requests.map((request) => [request.id, request]));
  return [...unique.values()]
    .filter((request) => request.status === 'pending' && !request.assignedVolunteerId)
    .map((request) => ({ request, interestMatch: doesRequestMatchActivityInterest(request, interests), availabilityMatch: availabilityIds.has(request.id) }))
    .sort((a, b) => (Number(b.interestMatch) * 2 + Number(b.availabilityMatch)) - (Number(a.interestMatch) * 2 + Number(a.availabilityMatch)));
}

/** Converts the time formats already used by request and availability forms to minutes after midnight. */
export function timeToMinutes(value: string): number | null {
  const normalized = value.trim();
  const twentyFourHour = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFourHour) {
    const hour = Number(twentyFourHour[1]);
    const minute = Number(twentyFourHour[2]);
    return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
  }

  const twelveHour = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*([AaPp][Mm])$/);
  if (!twelveHour) return null;
  const hour = Number(twelveHour[1]);
  const minute = Number(twelveHour[2] ?? 0);
  if (hour < 1 || hour > 12 || minute > 59) return null;
  return (hour % 12 + (twelveHour[3].toLowerCase() === 'pm' ? 12 : 0)) * 60 + minute;
}

function isSameCalendarDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function atTime(date: Date, minutes: number): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setMinutes(minutes);
  return result;
}

export interface ScheduledActivity {
  id: string;
  preferredDate: Date;
  preferredTime: string;
  durationMinutes?: number;
  status: CompanionshipRequest['status'];
}

export function scheduleBounds(activity: Pick<ScheduledActivity, 'preferredDate' | 'preferredTime' | 'durationMinutes'>) {
  const startMinutes = timeToMinutes(activity.preferredTime);
  if (startMinutes === null) return null;
  const start = atTime(activity.preferredDate, startMinutes);
  const duration = typeof activity.durationMinutes === 'number' && activity.durationMinutes > 0
    ? activity.durationMinutes
    : 0;
  return { start, end: new Date(start.getTime() + duration * 60_000) };
}

/** Endpoints may touch (one visit ends as another starts), but intervals may not overlap. */
export function schedulesOverlap(
  left: Pick<ScheduledActivity, 'preferredDate' | 'preferredTime' | 'durationMinutes'>,
  right: Pick<ScheduledActivity, 'preferredDate' | 'preferredTime' | 'durationMinutes'>,
): boolean {
  const leftBounds = scheduleBounds(left);
  const rightBounds = scheduleBounds(right);
  if (!leftBounds || !rightBounds) return false;
  return leftBounds.start < rightBounds.end && rightBounds.start < leftBounds.end;
}

export function findScheduleConflict(
  proposed: ScheduledActivity,
  activities: readonly ScheduledActivity[],
): ScheduledActivity | undefined {
  return activities.find((activity) =>
    activity.id !== proposed.id
    && ['accepted', 'scheduled', 'in_progress'].includes(activity.status)
    && schedulesOverlap(proposed, activity));
}

/** Rescheduling uses the same availability-window semantics as request matching. */
export function isScheduleWithinAvailability(
  proposed: ScheduledActivity,
  availability: readonly VolunteerAvailability[],
  now = new Date(),
): boolean {
  const candidate = {
    ...proposed,
    activityType: '',
    createdBy: '',
    location: '',
    status: 'pending',
    assignedVolunteerId: undefined,
  } as CompanionshipRequest;
  return availability.some((window) => doesRequestMatchAvailability(candidate, window, now));
}

/** A flexible or absent duration only needs its start time to be within the window. */
export function requestDurationMinutes(request: CompanionshipRequest): number {
  return typeof request.durationMinutes === 'number' && request.durationMinutes > 0
    ? request.durationMinutes
    : 0;
}

export function isOpenFutureRequest(request: CompanionshipRequest, now = new Date()): boolean {
  if (request.status !== 'pending' || request.assignedVolunteerId) return false;
  const startMinutes = timeToMinutes(request.preferredTime);
  if (startMinutes === null) return false;
  return atTime(request.preferredDate, startMinutes).getTime() > now.getTime();
}

export function isCurrentAvailability(availability: VolunteerAvailability, now = new Date()): boolean {
  if (!availability.isAvailable) return false;
  const endMinutes = timeToMinutes(availability.endTime);
  return endMinutes !== null && atTime(availability.date, endMinutes).getTime() > now.getTime();
}

/** True only when an open request fits in this one availability window. */
export function doesRequestMatchAvailability(
  request: CompanionshipRequest,
  availability: VolunteerAvailability,
  now = new Date(),
): boolean {
  if (!isOpenFutureRequest(request, now) || !isCurrentAvailability(availability, now)) return false;
  if (!isSameCalendarDay(request.preferredDate, availability.date)) return false;

  const requestStart = timeToMinutes(request.preferredTime);
  const availableStart = timeToMinutes(availability.startTime);
  const availableEnd = timeToMinutes(availability.endTime);
  if (requestStart === null || availableStart === null || availableEnd === null) return false;

  const requestEnd = requestStart + requestDurationMinutes(request);
  return requestStart >= availableStart && requestEnd <= availableEnd;
}

/** A request is listed once even if it fits more than one availability window. */
export function getMatchingRequestIds(
  requests: CompanionshipRequest[],
  availability: VolunteerAvailability[],
  now = new Date(),
): Set<string> {
  const currentWindows = availability.filter((item) => isCurrentAvailability(item, now));
  return new Set(
    requests
      .filter((request) => currentWindows.some((window) => doesRequestMatchAvailability(request, window, now)))
      .map((request) => request.id),
  );
}
