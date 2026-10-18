/// <reference types="jest" />
import {
  COMMENT_MAX_LENGTH,
  COMMENT_MIN_LENGTH,
  emptyFeedbackDraft,
  isRating,
  normaliseFeedbackDraft,
  validateFeedbackDraft,
} from './feedbackValidation';

const validDraft = {
  activityId: 'activity-1',
  rating: 4,
  comment: 'The volunteer arrived on time and explained everything clearly.',
};

it('accepts feedback with an activity and a real comment', () => {
  expect(validateFeedbackDraft(validDraft)).toEqual({ valid: true, errors: {} });
});

it('accepts a comment on its own, because the rating is optional', () => {
  expect(validateFeedbackDraft({ ...validDraft, rating: null }).valid).toBe(true);
  expect(validateFeedbackDraft({ ...validDraft, rating: 7 }).errors.rating).toBeDefined();
  expect(isRating(3)).toBe(true);
  expect(isRating(0)).toBe(false);
});

it('requires the feedback to name the activity it belongs to', () => {
  expect(validateFeedbackDraft({ ...validDraft, activityId: '   ' }).errors.activity).toBeDefined();
  expect(emptyFeedbackDraft('activity-9').activityId).toBe('activity-9');
  expect(emptyFeedbackDraft().comment).toBe('');
});

it('asks for a comment with enough detail to act on', () => {
  expect(validateFeedbackDraft({ ...validDraft, comment: '' }).errors.comment).toBeDefined();
  expect(validateFeedbackDraft({ ...validDraft, comment: '    ' }).errors.comment).toBeDefined();
  expect(validateFeedbackDraft({ ...validDraft, comment: 'a'.repeat(COMMENT_MIN_LENGTH - 1) }).errors.comment).toBeDefined();
  expect(validateFeedbackDraft({ ...validDraft, comment: 'a'.repeat(COMMENT_MIN_LENGTH) }).valid).toBe(true);
  expect(validateFeedbackDraft({ ...validDraft, comment: 'a'.repeat(COMMENT_MAX_LENGTH + 1) }).errors.comment).toBeDefined();
});

it('trims whitespace before anything is stored or measured', () => {
  const clean = normaliseFeedbackDraft({ activityId: ' activity-1 ', rating: 4, comment: '  Lovely visit today.  ' });
  expect(clean).toEqual({ activityId: 'activity-1', rating: 4, comment: 'Lovely visit today.' });

  // Padding must not carry a short comment past the minimum length.
  const padded = `  ${'a'.repeat(COMMENT_MIN_LENGTH - 1)}  `;
  expect(validateFeedbackDraft({ ...validDraft, comment: padded }).errors.comment).toBeDefined();
});
