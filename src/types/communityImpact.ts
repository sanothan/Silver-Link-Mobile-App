/**
 * "View Community Impact Dashboard" - the types shared by the aggregation, the Firestore
 * reads, and the administrator screen.
 *
 * Every number here is calculated from stored records at read time rather than kept in a
 * running counter, so the dashboard cannot drift away from what the system actually holds.
 */

/** The roles the dashboard counts separately. Anything else is a member we do not break out. */
export type ImpactRole = 'elderly' | 'volunteer' | 'caregiver' | 'admin' | 'other';

/** One user document, reduced to what the dashboard needs. */
export interface ImpactUser {
  id: string;
  role: ImpactRole;
}

/**
 * The statuses that mean a request is still waiting on somebody. These are the ones the
 * "active requests" figure counts, so a completed or cancelled request is never included.
 */
export const ACTIVE_ACTIVITY_STATUSES = ['open', 'accepted', 'in_progress'] as const;

/** One counted activity category, with the label the dashboard shows. */
export interface CategoryCount {
  /** The stored category value, lower cased; 'uncategorised' when the activity has none. */
  value: string;
  label: string;
  count: number;
}

/**
 * The finished figures the dashboard renders.
 *
 * `volunteerHours` is null rather than 0 when no completed activity recorded a duration,
 * so the screen can say the hours are not being tracked instead of claiming nobody has
 * volunteered - the acceptance criterion asks for hours "where available".
 */
export interface CommunityImpactStats {
  elderlyUsers: number;
  volunteers: number;
  caregivers: number;
  totalMembers: number;
  completedActivities: number;
  activeRequests: number;
  /** Total recorded volunteering hours, or null when no activity carries a duration. */
  volunteerHours: number | null;
  /** How many completed activities contributed to `volunteerHours`. */
  activitiesWithHours: number;
  /** Activity categories, most common first. */
  topCategories: CategoryCount[];
  /** When the figures were calculated, so the screen can say how fresh they are. */
  calculatedAt: Date;
}

/**
 * One request document, reduced to what the dashboard needs. It deliberately keeps its
 * own shape rather than reusing ActivitySummary: the dashboard cares about the category
 * and the recorded duration, which feedback and ratings have no use for.
 */
export interface ImpactActivity {
  id: string;
  status: string;
  /** The stored category or activity type; empty when the request recorded neither. */
  category: string;
  /** Volunteering hours recorded on the activity, or null when it recorded none. */
  hours: number | null;
}
