import { getOpenRequests } from './requestService';
import { getVolunteerAvailability } from './volunteerAvailabilityService';
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
  return new Set(classifyRequests(requests, availability, now).matched.map((result) => result.request.id));
}

/** Why a request did or did not line up with the volunteer's availability. */
export type MatchReason =
  | 'matched'
  | 'no-availability'
  | 'different-day'
  | 'outside-window'
  | 'unavailable-request';

export interface AvailabilityWindow {
  /** Local midnight of the day the window belongs to. */
  day: Date;
  startMinutes: number;
  endMinutes: number;
  /** Every availability record that contributed to this window. */
  availabilityIds: string[];
}

export interface RequestMatch {
  request: CompanionshipRequest;
  matches: boolean;
  reason: MatchReason;
  /** The availability records that cover the request, when it matches. */
  matchedAvailabilityIds: string[];
}

export interface VolunteerRequestMatches {
  matched: RequestMatch[];
  unmatched: RequestMatch[];
  /** False when the volunteer has not set any usable availability yet. */
  hasAvailability: boolean;
  /** True when availability could not be read; every request is then returned unmatched. */
  availabilityUnavailable: boolean;
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Turns raw availability records into the windows matching actually runs against:
 * only current, available records count, and windows on the same day that touch or
 * overlap are merged so a request spanning two back-to-back periods still matches.
 */
export function buildAvailabilityWindows(
  availability: VolunteerAvailability[],
  now = new Date(),
): AvailabilityWindow[] {
  const usable = availability
    .filter((item) => isCurrentAvailability(item, now))
    .map((item) => {
      const startMinutes = timeToMinutes(item.startTime);
      const endMinutes = timeToMinutes(item.endTime);
      if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return null;
      return { day: startOfDay(item.date), startMinutes, endMinutes, availabilityIds: [item.id] } satisfies AvailabilityWindow;
    })
    .filter((item): item is AvailabilityWindow => item !== null)
    .sort((a, b) => a.day.getTime() - b.day.getTime() || a.startMinutes - b.startMinutes);

  const merged: AvailabilityWindow[] = [];
  for (const window of usable) {
    const previous = merged[merged.length - 1];
    if (previous && previous.day.getTime() === window.day.getTime() && window.startMinutes <= previous.endMinutes) {
      previous.endMinutes = Math.max(previous.endMinutes, window.endMinutes);
      previous.availabilityIds.push(...window.availabilityIds);
      continue;
    }
    merged.push({ ...window, availabilityIds: [...window.availabilityIds] });
  }
  return merged;
}

/** Matches one request against prepared windows, explaining the outcome. */
export function matchRequestToWindows(
  request: CompanionshipRequest,
  windows: AvailabilityWindow[],
  now = new Date(),
): RequestMatch {
  if (!isOpenFutureRequest(request, now)) {
    return { request, matches: false, reason: 'unavailable-request', matchedAvailabilityIds: [] };
  }
  if (!windows.length) return { request, matches: false, reason: 'no-availability', matchedAvailabilityIds: [] };

  const requestDay = startOfDay(request.preferredDate).getTime();
  const sameDay = windows.filter((window) => window.day.getTime() === requestDay);
  if (!sameDay.length) return { request, matches: false, reason: 'different-day', matchedAvailabilityIds: [] };

  const start = timeToMinutes(request.preferredTime);
  if (start === null) return { request, matches: false, reason: 'unavailable-request', matchedAvailabilityIds: [] };
  const end = start + requestDurationMinutes(request);

  const covering = sameDay.filter((window) => start >= window.startMinutes && end <= window.endMinutes);
  if (!covering.length) return { request, matches: false, reason: 'outside-window', matchedAvailabilityIds: [] };
  return {
    request,
    matches: true,
    reason: 'matched',
    matchedAvailabilityIds: [...new Set(covering.flatMap((window) => window.availabilityIds))],
  };
}

/** Splits open requests into the ones the volunteer can realistically attend and the rest. */
export function classifyRequests(
  requests: CompanionshipRequest[],
  availability: VolunteerAvailability[],
  now = new Date(),
): Pick<VolunteerRequestMatches, 'matched' | 'unmatched' | 'hasAvailability'> {
  const windows = buildAvailabilityWindows(availability, now);
  const results = requests
    .filter((request) => isOpenFutureRequest(request, now))
    .map((request) => matchRequestToWindows(request, windows, now));
  return {
    matched: results.filter((result) => result.matches),
    unmatched: results.filter((result) => !result.matches),
    hasAvailability: windows.length > 0,
  };
}

/**
 * The matching API the volunteer screens call: loads the open requests and the
 * volunteer's availability, then returns them already split into matches and
 * everything else. Availability failures are reported rather than thrown, so a
 * volunteer can always keep browsing and opening request details.
 */
export async function getMatchedRequestsForVolunteer(
  volunteerId: string,
  now = new Date(),
): Promise<VolunteerRequestMatches> {
  const requests = await getOpenRequests();
  let availability: VolunteerAvailability[];
  try {
    availability = await getVolunteerAvailability(volunteerId);
  } catch {
    const open = requests.filter((request) => isOpenFutureRequest(request, now));
    return {
      matched: [],
      unmatched: open.map((request) => ({ request, matches: false, reason: 'no-availability', matchedAvailabilityIds: [] })),
      hasAvailability: false,
      availabilityUnavailable: true,
    };
  }
  return { ...classifyRequests(requests, availability, now), availabilityUnavailable: false };
}

/** Whether one already-loaded request fits the volunteer's availability. */
export async function getRequestMatchForVolunteer(
  volunteerId: string,
  request: CompanionshipRequest,
  now = new Date(),
): Promise<RequestMatch | null> {
  try {
    const windows = buildAvailabilityWindows(await getVolunteerAvailability(volunteerId), now);
    return windows.length ? matchRequestToWindows(request, windows, now) : null;
  } catch {
    return null;
  }
}
