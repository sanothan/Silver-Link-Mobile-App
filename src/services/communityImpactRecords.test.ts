/// <reference types="jest" />
import { asHours, toImpactActivity, toImpactUser } from './communityImpactStats';

it('reads a role case-insensitively and falls back to "other"', () => {
  expect(toImpactUser('u1', { role: 'Volunteer' }).role).toBe('volunteer');
  expect(toImpactUser('u2', { role: ' elderly ' }).role).toBe('elderly');
  expect(toImpactUser('u3', {}).role).toBe('other');
  expect(toImpactUser('u4', { role: 42 }).role).toBe('other');
});

it('reads a duration recorded in hours or in minutes', () => {
  expect(asHours({ durationHours: 2.5 })).toBe(2.5);
  expect(asHours({ hours: 3 })).toBe(3);
  expect(asHours({ durationMinutes: 90 })).toBe(1.5);
  expect(asHours({ minutes: 30 })).toBe(0.5);
});

it('accepts a duration stored as a numeric string, as the forms sometimes write it', () => {
  expect(asHours({ durationHours: '2' })).toBe(2);
  expect(asHours({ durationMinutes: '45' })).toBe(0.75);
});

it('treats a missing or unusable duration as no duration recorded', () => {
  expect(asHours({})).toBeNull();
  expect(asHours({ durationHours: 0 })).toBeNull();
  expect(asHours({ durationHours: -1 })).toBeNull();
  expect(asHours({ durationHours: 'soon' })).toBeNull();
});

it('prefers the hours field over minutes when an activity records both', () => {
  expect(asHours({ durationHours: 2, durationMinutes: 999 })).toBe(2);
});

it('reads an activity status and category, whichever field the request used', () => {
  expect(toImpactActivity('a1', { status: 'Completed', activityType: 'Transport' })).toEqual({
    id: 'a1',
    status: 'completed',
    category: 'Transport',
    hours: null,
  });
  expect(toImpactActivity('a2', { category: 'companionship' }).status).toBe('open');
  expect(toImpactActivity('a3', { type: 'errands' }).category).toBe('errands');
});
