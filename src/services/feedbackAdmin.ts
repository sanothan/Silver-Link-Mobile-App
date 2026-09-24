/**
 * "Manage Feedback and Reports" - the pure half of the administrator's feedback review.
 *
 * Everything here works on plain records so it can be reasoned about and tested without
 * Firestore. The screen and `feedbackService` share these helpers so the filter the
 * administrator sees and the summary above it can never disagree with each other.
 */
import type { FeedbackAuthorRole, FeedbackRecord } from '../types/feedback';
import { isAdmin } from './reportAccess';
import type { ReportViewer } from './reportAccess';

export class FeedbackReviewAccessError extends Error {
  constructor(message = 'You are not allowed to review submitted feedback.') {
    super(message);
    this.name = 'FeedbackReviewAccessError';
  }
}

/** Only administrators read the whole feedback collection; authors read their own. */
export function canReviewAllFeedback(viewer: ReportViewer | null): boolean {
  return isAdmin(viewer);
}

/** Narrows the viewer to a signed-in administrator, so callers can rely on their uid. */
export function assertCanReviewAllFeedback(viewer: ReportViewer | null): asserts viewer is ReportViewer {
  if (!canReviewAllFeedback(viewer)) throw new FeedbackReviewAccessError();
}

/**
 * How the administrator narrows the list. `all` is the default, `low_rated` surfaces the
 * feedback most likely to need follow-up, and the role filters answer "what are
 * volunteers telling us" without reading every card.
 */
export type FeedbackFilter = 'all' | 'low_rated' | 'unrated' | FeedbackAuthorRole;

/** At or below this many stars, feedback is treated as something to look into. */
export const LOW_RATING_THRESHOLD = 2;

export const FEEDBACK_FILTERS: { value: FeedbackFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'low_rated', label: 'Needs attention' },
  { value: 'elderly', label: 'From members' },
  { value: 'caregiver', label: 'From caregivers' },
  { value: 'volunteer', label: 'From volunteers' },
  { value: 'unrated', label: 'Comment only' },
];

export const AUTHOR_ROLE_LABEL: Record<FeedbackAuthorRole, string> = {
  elderly: 'Member',
  caregiver: 'Caregiver',
  volunteer: 'Volunteer',
  other: 'Member',
};

/** Feedback worth a second look: a rating was given and it was a low one. */
export function isLowRated(feedback: FeedbackRecord): boolean {
  return typeof feedback.rating === 'number' && feedback.rating <= LOW_RATING_THRESHOLD;
}

export function matchesFeedbackFilter(feedback: FeedbackRecord, filter: FeedbackFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'low_rated':
      return isLowRated(feedback);
    case 'unrated':
      return feedback.rating === null;
    default:
      return feedback.authorRole === filter;
  }
}

/** The filtered list, newest first, so the screen never has to sort it again. */
export function filterFeedback(feedback: FeedbackRecord[], filter: FeedbackFilter): FeedbackRecord[] {
  return feedback
    .filter((entry) => matchesFeedbackFilter(entry, filter))
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
}

export interface FeedbackSummary {
  total: number;
  /** How many of the total carried a star rating; the rest were comment-only. */
  rated: number;
  /** Mean of the ratings that were given, rounded to one decimal, or null when none were. */
  averageRating: number | null;
  lowRated: number;
}

/**
 * The headline numbers above the list. The average deliberately ignores comment-only
 * feedback rather than counting it as a zero, which would drag the platform score down
 * for people who simply chose not to rate.
 */
export function summariseFeedback(feedback: FeedbackRecord[]): FeedbackSummary {
  const ratings = feedback.map((entry) => entry.rating).filter((rating): rating is number => typeof rating === 'number');
  const total = feedback.length;
  const average = ratings.length > 0 ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null;
  return {
    total,
    rated: ratings.length,
    averageRating: average === null ? null : Math.round(average * 10) / 10,
    lowRated: feedback.filter(isLowRated).length,
  };
}
