import {
  FEEDBACK_FILTERS,
  FeedbackReviewAccessError,
  assertCanReviewAllFeedback,
  canReviewAllFeedback,
  filterFeedback,
  isLowRated,
  matchesFeedbackFilter,
  summariseFeedback,
} from './feedbackAdmin';
import type { FeedbackFilter } from './feedbackAdmin';
import type { FeedbackAuthorRole, FeedbackRecord } from '../types/feedback';

function feedback(overrides: Partial<FeedbackRecord> = {}): FeedbackRecord {
  return {
    id: 'f1',
    activityId: 'a1',
    activityTitle: 'Weekly shopping trip',
    rating: 5,
    comment: 'Everything went well and the volunteer was kind.',
    authorId: 'u1',
    authorRole: 'elderly' as FeedbackAuthorRole,
    createdAt: new Date('2026-01-10T10:00:00Z'),
    ...overrides,
  };
}

describe('who may review submitted feedback', () => {
  it('lets an administrator review all feedback', () => {
    expect(canReviewAllFeedback({ uid: 'admin-1', role: 'admin' })).toBe(true);
  });

  it('refuses members, volunteers, caregivers and signed-out visitors', () => {
    expect(canReviewAllFeedback({ uid: 'u1', role: 'elderly' })).toBe(false);
    expect(canReviewAllFeedback({ uid: 'u2', role: 'volunteer' })).toBe(false);
    expect(canReviewAllFeedback({ uid: 'u3', role: 'caregiver' })).toBe(false);
    expect(canReviewAllFeedback(null)).toBe(false);
  });

  it('throws for anybody who is not an administrator', () => {
    expect(() => assertCanReviewAllFeedback({ uid: 'u1', role: 'volunteer' })).toThrow(FeedbackReviewAccessError);
    expect(() => assertCanReviewAllFeedback(null)).toThrow(FeedbackReviewAccessError);
    expect(() => assertCanReviewAllFeedback({ uid: 'admin-1', role: 'admin' })).not.toThrow();
  });
});

describe('low-rated feedback', () => {
  it('treats one and two stars as needing attention', () => {
    expect(isLowRated(feedback({ rating: 1 }))).toBe(true);
    expect(isLowRated(feedback({ rating: 2 }))).toBe(true);
  });

  it('leaves three stars and above alone', () => {
    expect(isLowRated(feedback({ rating: 3 }))).toBe(false);
    expect(isLowRated(feedback({ rating: 5 }))).toBe(false);
  });

  it('does not treat a missing rating as a low one', () => {
    expect(isLowRated(feedback({ rating: null }))).toBe(false);
  });
});

describe('filtering the feedback list', () => {
  const entries = [
    feedback({ id: 'f1', rating: 1, authorRole: 'elderly', createdAt: new Date('2026-01-01T00:00:00Z') }),
    feedback({ id: 'f2', rating: 5, authorRole: 'volunteer', createdAt: new Date('2026-01-03T00:00:00Z') }),
    feedback({ id: 'f3', rating: null, authorRole: 'caregiver', createdAt: new Date('2026-01-02T00:00:00Z') }),
  ];

  it('returns everything under the default filter', () => {
    expect(filterFeedback(entries, 'all').map((entry) => entry.id)).toEqual(['f2', 'f3', 'f1']);
  });

  it('returns newest first', () => {
    const dates = filterFeedback(entries, 'all').map((entry) => entry.createdAt?.toISOString());
    expect(dates).toEqual(['2026-01-03T00:00:00.000Z', '2026-01-02T00:00:00.000Z', '2026-01-01T00:00:00.000Z']);
  });

  it('narrows to feedback that needs attention', () => {
    expect(filterFeedback(entries, 'low_rated').map((entry) => entry.id)).toEqual(['f1']);
  });

  it('narrows to comment-only feedback', () => {
    expect(filterFeedback(entries, 'unrated').map((entry) => entry.id)).toEqual(['f3']);
  });

  it('narrows by the role of the person who wrote it', () => {
    expect(filterFeedback(entries, 'volunteer').map((entry) => entry.id)).toEqual(['f2']);
    expect(filterFeedback(entries, 'elderly').map((entry) => entry.id)).toEqual(['f1']);
  });

  it('offers a filter for every chip the screen shows', () => {
    FEEDBACK_FILTERS.forEach((option) => {
      expect(() => filterFeedback(entries, option.value as FeedbackFilter)).not.toThrow();
    });
    expect(matchesFeedbackFilter(feedback(), 'all')).toBe(true);
  });
});

describe('summarising feedback', () => {
  it('reports zero totals for an empty collection', () => {
    expect(summariseFeedback([])).toEqual({ total: 0, rated: 0, averageRating: null, lowRated: 0 });
  });

  it('averages only the feedback that carried a rating', () => {
    const summary = summariseFeedback([
      feedback({ id: 'f1', rating: 4 }),
      feedback({ id: 'f2', rating: 5 }),
      feedback({ id: 'f3', rating: null }),
    ]);
    expect(summary.total).toBe(3);
    expect(summary.rated).toBe(2);
    expect(summary.averageRating).toBe(4.5);
  });

  it('rounds the average to one decimal place', () => {
    const summary = summariseFeedback([feedback({ rating: 4 }), feedback({ rating: 5 }), feedback({ rating: 5 })]);
    expect(summary.averageRating).toBe(4.7);
  });

  it('counts how much feedback needs attention', () => {
    const summary = summariseFeedback([feedback({ rating: 1 }), feedback({ rating: 2 }), feedback({ rating: 5 })]);
    expect(summary.lowRated).toBe(2);
  });
});
