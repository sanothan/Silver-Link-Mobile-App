import { isActivityCompleted, isActivityParticipant } from './feedbackAccess';
import type { ReportViewer } from './reportAccess';
import type { ActivitySummary } from '../types/feedback';
import type { RaterRole, VolunteerRatingRecord } from '../types/volunteerRating';

/**
 * Why a person may not rate the volunteer on an activity. The screen turns these into the
 * sentence it shows, so every refusal reads as an explanation rather than a dead end.
 */
export type RatingDenialReason =
  | 'signed-out'
  | 'not-completed'
  | 'no-volunteer'
  | 'not-a-participant'
  | 'self-rating'
  | 'already-rated';

export interface RatingEligibility {
  allowed: boolean;
  reason?: RatingDenialReason;
  message: string;
}

const DENIAL_MESSAGE: Record<RatingDenialReason, string> = {
  'signed-out': 'Please sign in to rate a volunteer.',
  'not-completed': 'You can rate the volunteer once this activity has been completed.',
  'no-volunteer': 'No volunteer took part in this activity, so there is nobody to rate.',
  'not-a-participant': 'You can only rate volunteers who helped with your own activities.',
  'self-rating': 'You cannot rate yourself for an activity you volunteered on.',
  'already-rated': 'You have already rated this volunteer for this activity. Thank you.',
};

export class VolunteerRatingAccessError extends Error {
  readonly reason: RatingDenialReason;

  constructor(reason: RatingDenialReason) {
    super(DENIAL_MESSAGE[reason]);
    this.name = 'VolunteerRatingAccessError';
    this.reason = reason;
  }
}

/** A volunteer can only be rated if one was actually assigned to the activity. */
export function hasRateableVolunteer(activity: ActivitySummary): boolean {
  return typeof activity.volunteerId === 'string' && activity.volunteerId.length > 0;
}

/** Whether the viewer is the volunteer the rating would be about. */
export function isTheVolunteer(activity: ActivitySummary, viewer: ReportViewer | null): boolean {
  return !!viewer && viewer.uid === activity.volunteerId;
}

/**
 * How the rater took part. Only the people the activity was *for* rate the volunteer, so
 * this never returns 'volunteer' - a volunteer rating themselves is refused outright.
 */
export function raterRoleFor(activity: ActivitySummary, viewer: ReportViewer): RaterRole {
  if (viewer.uid === activity.elderlyId) return 'elderly';
  if (viewer.role === 'caregiver' || viewer.role === 'elderly') return viewer.role;
  return 'other';
}

/**
 * The single gate every rating passes through: the activity must be completed, it must
 * have had a volunteer, the viewer must have taken part as somebody the activity was for,
 * and nobody may rate the same volunteer twice for the same activity.
 *
 * `existing` is the rating the viewer has already given for this activity, if any.
 */
export function canRateVolunteer(
  activity: ActivitySummary,
  viewer: ReportViewer | null,
  existing?: VolunteerRatingRecord | null,
): RatingEligibility {
  if (!viewer) return refuse('signed-out');
  if (!isActivityCompleted(activity)) return refuse('not-completed');
  if (!hasRateableVolunteer(activity)) return refuse('no-volunteer');
  if (!isActivityParticipant(activity, viewer)) return refuse('not-a-participant');
  // Checked after participation so a volunteer on their own activity gets the clearer
  // "you cannot rate yourself" rather than being told they took no part.
  if (isTheVolunteer(activity, viewer)) return refuse('self-rating');
  if (existing) return refuse('already-rated');
  return { allowed: true, message: '' };
}

function refuse(reason: RatingDenialReason): RatingEligibility {
  return { allowed: false, reason, message: DENIAL_MESSAGE[reason] };
}

/** Narrows the viewer to somebody entitled to give this rating, or throws. */
export function assertCanRateVolunteer(
  activity: ActivitySummary,
  viewer: ReportViewer | null,
  existing?: VolunteerRatingRecord | null,
): asserts viewer is ReportViewer {
  const eligibility = canRateVolunteer(activity, viewer, existing);
  if (!eligibility.allowed) throw new VolunteerRatingAccessError(eligibility.reason!);
}

/** The activities whose volunteer this person may rate: completed, theirs, not their own work. */
export function rateableActivities(activities: ActivitySummary[], viewer: ReportViewer | null): ActivitySummary[] {
  if (!viewer) return [];
  return activities.filter((activity) => canRateVolunteer(activity, viewer).allowed);
}
