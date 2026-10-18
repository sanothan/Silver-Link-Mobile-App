/// <reference types="jest" />
import { overlapsAvailability } from './volunteerAvailabilityValidation';
import type { VolunteerAvailability } from '../types/volunteer';

const saved = (startTime = '09:00', endTime = '11:00', id = 'saved'): VolunteerAvailability => ({ id, volunteerId: 'volunteer-1', date: new Date(2026, 8, 24), startTime, endTime, isAvailable: true });
const candidate = (startTime: string, endTime: string) => ({ date: new Date(2026, 8, 24), startTime, endTime });

it.each([['09:00', '11:00'], ['08:00', '10:00'], ['10:00', '12:00'], ['09:30', '10:30']])('rejects %s-%s overlap', (start, end) => {
  expect(overlapsAvailability(candidate(start, end), [saved()])).toBe(true);
});

it('allows adjacent slots, different dates, withdrawn slots, and an edit of itself', () => {
  expect(overlapsAvailability(candidate('11:00', '12:00'), [saved()])).toBe(false);
  expect(overlapsAvailability(candidate('09:00', '10:00'), [{ ...saved(), date: new Date(2026, 8, 25) }])).toBe(false);
  expect(overlapsAvailability(candidate('09:00', '10:00'), [{ ...saved(), isAvailable: false }])).toBe(false);
  expect(overlapsAvailability(candidate('09:00', '10:00'), [saved()], 'saved')).toBe(false);
});
