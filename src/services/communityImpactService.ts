import { collection, getDocs, limit as queryLimit, query } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { assertCanViewCommunityImpact } from './communityImpactAccess';
import { summariseCommunityImpact, toImpactActivity, toImpactUser } from './communityImpactStats';
import type { ReportViewer } from './reportAccess';
import type { CommunityImpactStats } from '../types/communityImpact';

const USERS_COLLECTION = 'users';
const ACTIVITIES_COLLECTION = 'requests';

/**
 * How many documents a single dashboard read will pull. The dashboard is a summary, not a
 * report, so it is capped rather than paged: a cap keeps one screen from reading an
 * unbounded collection, and `truncated` below tells the administrator when it bit.
 */
export const IMPACT_READ_LIMIT = 500;

/** The dashboard figures, plus whether the read hit its cap. Administrators only. */
export interface CommunityImpactResult {
  stats: CommunityImpactStats;
  /** True when either collection filled the read limit, so the figures are a lower bound. */
  truncated: boolean;
}

/**
 * Reads the members and requests the system holds and calculates the dashboard from them,
 * so every figure on screen comes from actual records rather than a stored counter.
 *
 * Throws CommunityImpactAccessError for anybody who is not an administrator, before any
 * read is attempted, so a non-administrator never even learns how large the collections
 * are. Firestore's own rules refuse the reads as well - this check is what lets the screen
 * show a clear "administrators only" message instead of a permission error.
 */
export async function getCommunityImpact(viewer: ReportViewer | null): Promise<CommunityImpactResult> {
  if (!db) throw new Error('Firebase is not configured.');
  assertCanViewCommunityImpact(viewer);

  const [userDocs, activityDocs] = await Promise.all([
    getDocs(query(collection(db, USERS_COLLECTION), queryLimit(IMPACT_READ_LIMIT))),
    getDocs(query(collection(db, ACTIVITIES_COLLECTION), queryLimit(IMPACT_READ_LIMIT))),
  ]);

  const users = userDocs.docs.map((item) => toImpactUser(item.id, item.data() as Record<string, unknown>));
  const activities = activityDocs.docs.map((item) =>
    toImpactActivity(item.id, item.data() as Record<string, unknown>),
  );

  return {
    stats: summariseCommunityImpact(users, activities),
    truncated: users.length >= IMPACT_READ_LIMIT || activities.length >= IMPACT_READ_LIMIT,
  };
}
