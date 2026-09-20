import { ACTIVE_ACTIVITY_STATUSES } from '../types/communityImpact';
import type { CategoryCount, CommunityImpactStats, ImpactActivity, ImpactRole, ImpactUser } from '../types/communityImpact';

/** How many categories the dashboard shows before the list stops being a summary. */
export const TOP_CATEGORY_LIMIT = 5;

const UNCATEGORISED = 'uncategorised';

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asRole(value: unknown): ImpactRole {
  const role = asText(value).trim().toLowerCase();
  return role === 'elderly' || role === 'volunteer' || role === 'caregiver' || role === 'admin' ? role : 'other';
}

function asPositiveNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * The volunteering hours recorded on an activity. Requests may record a duration in hours
 * or in minutes depending on which screen created them, and a numeric string is accepted
 * because form input is not always converted before it is stored. Anything else - and any
 * value that is not a positive, finite number - is read as "no duration recorded".
 */
export function asHours(data: Record<string, unknown>): number | null {
  const hours = asPositiveNumber(data.durationHours ?? data.hours ?? data.volunteerHours);
  if (hours !== null) return hours;
  const minutes = asPositiveNumber(data.durationMinutes ?? data.minutes);
  return minutes === null ? null : minutes / 60;
}

/** One `users` document, reduced to the role the dashboard counts it under. */
export function toImpactUser(id: string, data: Record<string, unknown>): ImpactUser {
  return { id, role: asRole(data.role) };
}

/**
 * One `requests` document as the dashboard reads it. The category is taken from whichever
 * field the request screens happened to write, so an activity is not dropped from the
 * breakdown because it recorded its type under a different name.
 */
export function toImpactActivity(id: string, data: Record<string, unknown>): ImpactActivity {
  return {
    id,
    status: asText(data.status).trim().toLowerCase() || 'open',
    category: asText(data.category) || asText(data.activityType) || asText(data.type),
    hours: asHours(data),
  };
}

export function isActiveStatus(status: string): boolean {
  return (ACTIVE_ACTIVITY_STATUSES as readonly string[]).includes(status);
}

/**
 * Turns a stored category value into something readable: 'grocery_shopping' and
 * 'grocery shopping' both come back as 'Grocery shopping', so the same activity type
 * recorded two ways is not shown as two different categories.
 */
export function formatCategoryLabel(value: string): string {
  if (!value || value === UNCATEGORISED) return 'Uncategorised';
  const words = value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!words) return 'Uncategorised';
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
}

/** The category an activity is counted under, normalised so counts group correctly. */
export function normaliseCategory(category: string): string {
  const clean = category.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  return clean || UNCATEGORISED;
}

/**
 * Counts how often each category appears among the given activities, most common first.
 * Ties are broken alphabetically so the same data always produces the same list rather
 * than whatever order Firestore happened to return the documents in.
 */
export function countCategories(activities: ImpactActivity[], limit = TOP_CATEGORY_LIMIT): CategoryCount[] {
  const counts = new Map<string, number>();
  for (const activity of activities) {
    const key = normaliseCategory(activity.category);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, label: formatCategoryLabel(value), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function countRole(users: ImpactUser[], role: ImpactRole): number {
  return users.filter((user) => user.role === role).length;
}

/** One decimal place, so 12.25 hours reads as 12.3 rather than 12.25. */
function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * The whole dashboard, calculated from the users and requests actually stored.
 *
 * Completed activities are the ones that count towards volunteering hours and towards the
 * category breakdown, because those figures describe work that happened. Active requests
 * are counted from the open statuses instead, so a request that was cancelled never reads
 * as outstanding work. An activity without a recorded duration contributes nothing to the
 * hours rather than counting as zero, which is what lets the screen distinguish "nobody
 * has volunteered" from "durations are not being recorded yet".
 */
export function summariseCommunityImpact(
  users: ImpactUser[],
  activities: ImpactActivity[],
  calculatedAt: Date = new Date(),
): CommunityImpactStats {
  const completed = activities.filter((activity) => activity.status === 'completed');

  let hoursTotal = 0;
  let activitiesWithHours = 0;
  for (const activity of completed) {
    if (activity.hours === null || !Number.isFinite(activity.hours) || activity.hours <= 0) continue;
    hoursTotal += activity.hours;
    activitiesWithHours += 1;
  }

  return {
    elderlyUsers: countRole(users, 'elderly'),
    volunteers: countRole(users, 'volunteer'),
    caregivers: countRole(users, 'caregiver'),
    totalMembers: users.length,
    completedActivities: completed.length,
    activeRequests: activities.filter((activity) => isActiveStatus(activity.status)).length,
    volunteerHours: activitiesWithHours > 0 ? roundToOneDecimal(hoursTotal) : null,
    activitiesWithHours,
    topCategories: countCategories(completed),
    calculatedAt,
  };
}

/** The hours as the screen shows them, including the wording when none are recorded. */
export function formatVolunteerHours(stats: CommunityImpactStats): string {
  if (stats.volunteerHours === null) return 'Not recorded yet';
  const hours = stats.volunteerHours;
  return `${hours.toFixed(1)} hour${hours === 1 ? '' : 's'}`;
}
