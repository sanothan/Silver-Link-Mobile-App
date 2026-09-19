import { VOLUNTEER_RATING_SCALE } from '../types/volunteerRating';
import type { VolunteerRatingDraft } from '../types/volunteerRating';

export const RATING_COMMENT_MAX_LENGTH = 500;

export type VolunteerRatingField = 'activity' | 'score' | 'comment';

export interface VolunteerRatingValidationResult {
  valid: boolean;
  errors: Partial<Record<VolunteerRatingField, string>>;
}

/** True only for a whole number that is one of the steps on the agreed 1-5 scale. */
export function isVolunteerRatingScore(value: unknown): value is number {
  return VOLUNTEER_RATING_SCALE.some((option) => option.value === value);
}

export function normaliseVolunteerRatingDraft(draft: VolunteerRatingDraft): VolunteerRatingDraft {
  return {
    activityId: draft.activityId.trim(),
    score: isVolunteerRatingScore(draft.score) ? draft.score : null,
    comment: draft.comment.trim(),
  };
}

/**
 * A rating must name the activity it belongs to and carry a score on the agreed scale.
 * The comment stays optional: the story asks for a rating, and an older user should be
 * able to recognise a good volunteer with one tap rather than a paragraph.
 */
export function validateVolunteerRatingDraft(draft: VolunteerRatingDraft): VolunteerRatingValidationResult {
  const clean = normaliseVolunteerRatingDraft(draft);
  const errors: Partial<Record<VolunteerRatingField, string>> = {};

  if (!clean.activityId) {
    errors.activity = 'Choose the completed activity this rating is about.';
  }

  if (clean.score === null) {
    errors.score = 'Choose a rating from 1 to 5 stars.';
  }

  if (clean.comment.length > RATING_COMMENT_MAX_LENGTH) {
    errors.comment = `Please keep your comment under ${RATING_COMMENT_MAX_LENGTH} characters.`;
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
