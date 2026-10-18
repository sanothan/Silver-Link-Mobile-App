/// <reference types="jest" />
import {
  RATING_COMMENT_MAX_LENGTH,
  isVolunteerRatingScore,
  normaliseVolunteerRatingDraft,
  validateVolunteerRatingDraft,
} from './volunteerRatingValidation';
import { emptyVolunteerRatingDraft } from '../types/volunteerRating';

it('accepts only whole scores from 1 to 5', () => {
  expect(isVolunteerRatingScore(1)).toBe(true);
  expect(isVolunteerRatingScore(5)).toBe(true);
  expect(isVolunteerRatingScore(0)).toBe(false);
  expect(isVolunteerRatingScore(6)).toBe(false);
  expect(isVolunteerRatingScore(4.5)).toBe(false);
  expect(isVolunteerRatingScore('5')).toBe(false);
  expect(isVolunteerRatingScore(null)).toBe(false);
});

it('requires an activity and a score', () => {
  const result = validateVolunteerRatingDraft(emptyVolunteerRatingDraft());
  expect(result.valid).toBe(false);
  expect(result.errors.activity).toBeTruthy();
  expect(result.errors.score).toBeTruthy();
});

it('accepts a score on its own, without a comment', () => {
  const result = validateVolunteerRatingDraft({ activityId: 'activity-1', score: 4, comment: '' });
  expect(result.valid).toBe(true);
  expect(result.errors).toEqual({});
});

it('rejects a score that is off the scale', () => {
  const result = validateVolunteerRatingDraft({ activityId: 'activity-1', score: 7, comment: '' });
  expect(result.valid).toBe(false);
  expect(result.errors.score).toBeTruthy();
});

it('rejects an over-long comment', () => {
  const result = validateVolunteerRatingDraft({
    activityId: 'activity-1',
    score: 4,
    comment: 'x'.repeat(RATING_COMMENT_MAX_LENGTH + 1),
  });
  expect(result.valid).toBe(false);
  expect(result.errors.comment).toBeTruthy();
});

it('trims whitespace so a blank comment never counts as text', () => {
  const clean = normaliseVolunteerRatingDraft({ activityId: '  activity-1  ', score: 3, comment: '   ' });
  expect(clean).toEqual({ activityId: 'activity-1', score: 3, comment: '' });
});
