/// <reference types="jest" />
import { overlapsAvailability } from './volunteerAvailabilityValidation';
import type { VolunteerAvailability } from '../types/volunteer';

const slot = (startTime: string, endTime: string, id = 'saved'): VolunteerAvailability => ({ id, volunteerId: 'v1', date: new Date(2026, 8, 24), startTime, endTime, isAvailable: true });
const candidate = (startTime: string, endTime: string) => ({ date: new Date(2026, 8, 24), startTime, endTime });

it.each([['09:00', '11:00'], ['08:00', '10:00'], ['10:00', '12:00'], ['09:30', '10:30']])('rejects %s-%s overlapping a saved window', (start, end) => {
  expect(overlapsAvailability(candidate(start, end), [slot('09:00', '11:00')])).toBe(true);
});

it('allows adjacent, different-day, removed, and self-edit windows', () => {
  expect(overlapsAvailability(candidate('11:00', '12:00'), [slot('09:00', '11:00')])).toBe(false);
  expect(overlapsAvailability(candidate('09:00', '10:00'), [{ ...slot('09:00', '11:00'), date: new Date(2026, 8, 25) }])).toBe(false);
  expect(overlapsAvailability(candidate('09:00', '10:00'), [{ ...slot('09:00', '11:00'), isAvailable: false }])).toBe(false);
  expect(overlapsAvailability(candidate('09:00', '10:00'), [slot('09:00', '11:00')], 'saved')).toBe(false);
});
