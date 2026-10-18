/// <reference types="jest" />
import {
  countCategories,
  formatCategoryLabel,
  formatVolunteerHours,
  summariseCommunityImpact,
} from './communityImpactStats';
import type { ImpactActivity, ImpactRole, ImpactUser } from '../types/communityImpact';

let sequence = 0;

function user(role: ImpactRole): ImpactUser {
  sequence += 1;
  return { id: `${role}-${sequence}`, role };
}

function activity(overrides: Partial<ImpactActivity> = {}): ImpactActivity {
  sequence += 1;
  return {
    id: `activity-${sequence}`,
    status: 'completed',
    category: 'grocery_shopping',
    hours: null,
    ...overrides,
  };
}

it('counts registered members by role', () => {
  const stats = summariseCommunityImpact(
    [user('elderly'), user('elderly'), user('volunteer'), user('caregiver'), user('admin'), user('other')],
    [],
  );
  expect(stats.elderlyUsers).toBe(2);
  expect(stats.volunteers).toBe(1);
  expect(stats.caregivers).toBe(1);
  expect(stats.totalMembers).toBe(6);
});

it('counts completed activities and separates them from active requests', () => {
  const stats = summariseCommunityImpact(
    [],
    [
      activity({ status: 'completed' }),
      activity({ status: 'completed' }),
      activity({ status: 'open' }),
      activity({ status: 'accepted' }),
      activity({ status: 'in_progress' }),
      activity({ status: 'cancelled' }),
    ],
  );
  expect(stats.completedActivities).toBe(2);
  expect(stats.activeRequests).toBe(3);
});

it('totals the recorded volunteering hours of completed activities only', () => {
  const stats = summariseCommunityImpact(
    [],
    [
      activity({ status: 'completed', hours: 2 }),
      activity({ status: 'completed', hours: 1.25 }),
      activity({ status: 'completed', hours: null }),
      activity({ status: 'in_progress', hours: 10 }),
    ],
  );
  expect(stats.volunteerHours).toBe(3.3);
  expect(stats.activitiesWithHours).toBe(2);
  expect(formatVolunteerHours(stats)).toBe('3.3 hours');
});

it('reports hours as unrecorded rather than zero when no activity carries a duration', () => {
  const stats = summariseCommunityImpact([], [activity({ status: 'completed', hours: null })]);
  expect(stats.volunteerHours).toBeNull();
  expect(stats.activitiesWithHours).toBe(0);
  expect(formatVolunteerHours(stats)).toBe('Not recorded yet');
});

it('ignores durations that are not a usable positive number', () => {
  const stats = summariseCommunityImpact(
    [],
    [
      activity({ status: 'completed', hours: 0 }),
      activity({ status: 'completed', hours: -3 }),
      activity({ status: 'completed', hours: Number.NaN }),
    ],
  );
  expect(stats.volunteerHours).toBeNull();
});

it('reads a single recorded hour in the singular', () => {
  const stats = summariseCommunityImpact([], [activity({ status: 'completed', hours: 1 })]);
  expect(formatVolunteerHours(stats)).toBe('1.0 hour');
});

it('groups the same category however it was spelled and ranks the most common first', () => {
  const counts = countCategories([
    activity({ category: 'grocery_shopping' }),
    activity({ category: 'Grocery Shopping' }),
    activity({ category: 'grocery-shopping' }),
    activity({ category: 'companionship' }),
    activity({ category: '' }),
  ]);
  expect(counts[0]).toEqual({ value: 'grocery shopping', label: 'Grocery shopping', count: 3 });
  expect(counts.map((entry) => entry.label)).toEqual(['Grocery shopping', 'Companionship', 'Uncategorised']);
});

it('breaks ties alphabetically so the same records always read the same way', () => {
  const counts = countCategories([activity({ category: 'transport' }), activity({ category: 'companionship' })]);
  expect(counts.map((entry) => entry.label)).toEqual(['Companionship', 'Transport']);
});

it('shows at most the requested number of categories', () => {
  const counts = countCategories(
    ['a', 'b', 'c', 'd', 'e', 'f'].map((category) => activity({ category })),
    5,
  );
  expect(counts).toHaveLength(5);
});

it('counts categories from completed activities only', () => {
  const stats = summariseCommunityImpact(
    [],
    [activity({ status: 'completed', category: 'transport' }), activity({ status: 'open', category: 'transport' })],
  );
  expect(stats.topCategories).toEqual([{ value: 'transport', label: 'Transport', count: 1 }]);
});

it('labels a stored category readably', () => {
  expect(formatCategoryLabel('medical_appointment')).toBe('Medical appointment');
  expect(formatCategoryLabel('')).toBe('Uncategorised');
});
