import { RATING_OPTIONS } from '../types/feedback';
import type { FeedbackDraft } from '../types/feedback';

export const COMMENT_MIN_LENGTH = 10;
export const COMMENT_MAX_LENGTH = 1000;

export type FeedbackField = 'activity' | 'rating' | 'comment';

export interface FeedbackValidationResult {
  valid: boolean;
  errors: Partial<Record<FeedbackField, string>>;
}

export function isRating(value: unknown): value is number {
  return RATING_OPTIONS.some((option) => option.value === value);
}

/** Trims the comment so trailing whitespace never counts towards the minimum length. */
export function normaliseFeedbackDraft(draft: FeedbackDraft): FeedbackDraft {
  return {
    activityId: draft.activityId.trim(),
    rating: isRating(draft.rating) ? draft.rating : null,
    comment: draft.comment.trim(),
  };
}

/**
 * Feedback must name the activity it belongs to and carry a comment worth reading. The
 * rating stays optional, because the story only asks for comments and an older user
 * should never be blocked by a control they chose to skip.
 */
export function validateFeedbackDraft(draft: FeedbackDraft): FeedbackValidationResult {
  const clean = normaliseFeedbackDraft(draft);
  const errors: Partial<Record<FeedbackField, string>> = {};

  if (!clean.activityId) {
    errors.activity = 'Choose the completed activity this feedback is about.';
  }

  if (draft.rating !== null && !isRating(draft.rating)) {
    errors.rating = 'Choose a rating between 1 and 5, or leave it blank.';
  }

  if (!clean.comment) {
    errors.comment = 'Tell us how the activity went so SilverLink can improve.';
  } else if (clean.comment.length < COMMENT_MIN_LENGTH) {
    errors.comment = `Please add a little more detail (at least ${COMMENT_MIN_LENGTH} characters).`;
  } else if (clean.comment.length > COMMENT_MAX_LENGTH) {
    errors.comment = `Please keep your feedback under ${COMMENT_MAX_LENGTH} characters.`;
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function emptyFeedbackDraft(activityId = ''): FeedbackDraft {
  return { activityId, rating: null, comment: '' };
}
