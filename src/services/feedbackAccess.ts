import { COMPLETED_ACTIVITY_STATUS } from '../types/feedback';
import type { ActivitySummary, FeedbackAuthorRole, FeedbackRecord } from '../types/feedback';
import type { ReportViewer } from './reportAccess';

/**
 * Why a person may not leave feedback on an activity. The screen turns these into the
 * sentence it shows, so every refusal reads as an explanation rather than a dead end.
 */
export type FeedbackDenialReason = 'signed-out' | 'not-completed' | 'not-a-participant' | 'already-submitted';

export interface FeedbackEligibility {
  allowed: boolean;
  reason?: FeedbackDenialReason;
  message: string;
}

const DENIAL_MESSAGE: Record<FeedbackDenialReason, string> = {
  'signed-out': 'Please sign in to leave feedback about an activity.',
  'not-completed': 'You can leave feedback once this activity has been completed.',
  'not-a-participant': 'You can only leave feedback about activities you took part in.',
  'already-submitted': 'You have already left feedback for this activity. Thank you.',
};

export class FeedbackAccessError extends Error {
  readonly reason: FeedbackDenialReason;

  constructor(reason: FeedbackDenialReason) {
    super(DENIAL_MESSAGE[reason]);
    this.name = 'FeedbackAccessError';
    this.reason = reason;
  }
}

/** Feedback is only ever available after the activity finished. */
export function isActivityCompleted(activity: ActivitySummary): boolean {
  return activity.status === COMPLETED_ACTIVITY_STATUS;
}

/**
 * Whether the viewer took part in the activity. Administrators are deliberately not
 * treated as participants: they read feedback, they do not author it on someone's behalf.
 */
export function isActivityParticipant(activity: ActivitySummary, viewer: ReportViewer | null): boolean {
  if (!viewer) return false;
  return activity.participantIds.includes(viewer.uid);
}

/** How the viewer took part, recorded alongside the comment so admins keep the context. */
export function authorRoleFor(activity: ActivitySummary, viewer: ReportViewer): FeedbackAuthorRole {
  if (viewer.uid === activity.volunteerId) return 'volunteer';
  if (viewer.uid === activity.elderlyId) return 'elderly';
  if (viewer.role === 'caregiver' || viewer.role === 'elderly' || viewer.role === 'volunteer') {
    return viewer.role;
  }
  return 'other';
}

/**
 * The single gate every feedback submission passes through: the activity must be
 * completed, the viewer must have taken part in it, and nobody may comment twice.
 * `existing` is the feedback the viewer has already left for this activity, if any.
 */
export function canSubmitFeedback(
  activity: ActivitySummary,
  viewer: ReportViewer | null,
  existing?: FeedbackRecord | null,
): FeedbackEligibility {
  if (!viewer) return { allowed: false, reason: 'signed-out', message: DENIAL_MESSAGE['signed-out'] };
  if (!isActivityCompleted(activity)) {
    return { allowed: false, reason: 'not-completed', message: DENIAL_MESSAGE['not-completed'] };
  }
  if (!isActivityParticipant(activity, viewer)) {
    return { allowed: false, reason: 'not-a-participant', message: DENIAL_MESSAGE['not-a-participant'] };
  }
  if (existing) {
    return { allowed: false, reason: 'already-submitted', message: DENIAL_MESSAGE['already-submitted'] };
  }
  return { allowed: true, message: '' };
}

/** Narrows the viewer to somebody entitled to leave this feedback, or throws. */
export function assertCanSubmitFeedback(
  activity: ActivitySummary,
  viewer: ReportViewer | null,
  existing?: FeedbackRecord | null,
): asserts viewer is ReportViewer {
  const eligibility = canSubmitFeedback(activity, viewer, existing);
  if (!eligibility.allowed) throw new FeedbackAccessError(eligibility.reason!);
}

/** The activities a person may comment on: the completed ones they took part in. */
export function feedbackEligibleActivities(
  activities: ActivitySummary[],
  viewer: ReportViewer | null,
): ActivitySummary[] {
  if (!viewer) return [];
  return activities.filter((activity) => isActivityCompleted(activity) && isActivityParticipant(activity, viewer));
}
