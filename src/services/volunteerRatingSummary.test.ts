/// <reference types="jest" />
import { formatRatingSummary, summariseVolunteerRatings } from './volunteerRatingSummary';
import type { VolunteerRatingRecord } from '../types/volunteerRating';

function rating(score: number, overrides: Partial<VolunteerRatingRecord> = {}): VolunteerRatingRecord {
  return {
    id: `rating-${score}-${overrides.raterId ?? 'r'}`,
    activityId: 'activity-1',
    activityTitle: 'Trip to the pharmacy',
    volunteerId: 'volunteer-1',
    score,
    comment: '',
    raterId: 'elderly-7',
    raterRole: 'elderly',
    ...overrides,
  };
}

it('reports an unrated volunteer as unrated rather than as a zero', () => {
  const summary = summariseVolunteerRatings('volunteer-1', []);
  expect(summary.count).toBe(0);
  expect(summary.average).toBeNull();
  expect(summary.distribution).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  expect(formatRatingSummary(summary)).toBe('Not yet rated');
});

it('averages the scores and counts each step of the scale', () => {
  const summary = summariseVolunteerRatings('volunteer-1', [
    rating(5, { raterId: 'a' }),
    rating(4, { raterId: 'b' }),
    rating(3, { raterId: 'c' }),
    rating(5, { raterId: 'd' }),
  ]);
  expect(summary.count).toBe(4);
  expect(summary.average).toBe(4.3);
  expect(summary.distribution).toEqual({ 1: 0, 2: 0, 3: 1, 4: 1, 5: 2 });
  expect(formatRatingSummary(summary)).toBe('4.3 out of 5 (4 ratings)');
});

it('reads a single rating in the singular', () => {
  const summary = summariseVolunteerRatings('volunteer-1', [rating(2)]);
  expect(summary.average).toBe(2);
  expect(formatRatingSummary(summary)).toBe('2.0 out of 5 (1 rating)');
});

it('ignores ratings that belong to another volunteer', () => {
  const summary = summariseVolunteerRatings('volunteer-1', [
    rating(5, { raterId: 'a' }),
    rating(1, { raterId: 'b', volunteerId: 'volunteer-2' }),
  ]);
  expect(summary.count).toBe(1);
  expect(summary.average).toBe(5);
});

it('ignores scores that are not on the agreed scale', () => {
  const summary = summariseVolunteerRatings('volunteer-1', [
    rating(4, { raterId: 'a' }),
    rating(0, { raterId: 'b' }),
    rating(9, { raterId: 'c' }),
    rating(3.5, { raterId: 'd' }),
  ]);
  expect(summary.count).toBe(1);
  expect(summary.average).toBe(4);
});
