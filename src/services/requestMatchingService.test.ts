import { doesRequestMatchAvailability, getMatchingRequestIds } from './requestMatchingService';
import type { CompanionshipRequest } from '../types/request';
import type { VolunteerAvailability } from '../types/volunteer';

const now = new Date(2026, 7, 1, 8, 0);
const request = (overrides: Partial<CompanionshipRequest> = {}): CompanionshipRequest => ({ id: 'request-1', createdBy: 'elderly-1', activityType: 'Friendly Conversation', preferredDate: new Date(2026, 7, 25), preferredTime: '3:00 PM', durationMinutes: 60, location: 'Colombo 05', status: 'pending', ...overrides });
const availability = (overrides: Partial<VolunteerAvailability> = {}): VolunteerAvailability => ({ id: 'availability-1', volunteerId: 'volunteer-1', date: new Date(2026, 7, 25), startTime: '14:00', endTime: '17:00', isAvailable: true, ...overrides });

describe('request availability matching', () => {
  it('matches when the full duration fits in a same-date availability window', () => expect(doesRequestMatchAvailability(request(), availability(), now)).toBe(true));
  it('does not match when the request starts before availability', () => expect(doesRequestMatchAvailability(request({ preferredTime: '1:00 PM' }), availability(), now)).toBe(false));
  it('does not match when the request ends after availability', () => expect(doesRequestMatchAvailability(request({ preferredTime: '4:30 PM' }), availability(), now)).toBe(false));
  it('does not match a different date', () => expect(doesRequestMatchAvailability(request({ preferredDate: new Date(2026, 7, 26) }), availability(), now)).toBe(false));
  it('matches any valid window once when availability has multiple windows', () => {
    const ids = getMatchingRequestIds([request()], [availability({ id: 'morning', startTime: '09:00', endTime: '12:00' }), availability({ id: 'afternoon', startTime: '14:00', endTime: '17:00' }), availability({ id: 'overlap', startTime: '14:30', endTime: '18:00' })], now);
    expect([...ids]).toEqual(['request-1']);
  });
  it('never matches assigned, cancelled, or past requests', () => {
    expect(doesRequestMatchAvailability(request({ assignedVolunteerId: 'other' }), availability(), now)).toBe(false);
    expect(doesRequestMatchAvailability(request({ status: 'cancelled' }), availability(), now)).toBe(false);
    expect(doesRequestMatchAvailability(request({ preferredDate: new Date(2026, 6, 25) }), availability({ date: new Date(2026, 6, 25) }), now)).toBe(false);
  });
});
