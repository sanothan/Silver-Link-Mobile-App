import { getOpenRequests } from './requestService';
import { getVolunteerAvailability } from './volunteerAvailabilityService';
import { buildAvailabilityWindows, classifyRequests, getMatchedRequestsForVolunteer, getRequestMatchForVolunteer, doesRequestMatchAvailability, getMatchingRequestIds, matchRequestToWindows } from './requestMatchingService';
import type { CompanionshipRequest } from '../types/request';
import type { VolunteerAvailability } from '../types/volunteer';

jest.mock('./requestService', () => ({ getOpenRequests: jest.fn() }));
jest.mock('./volunteerAvailabilityService', () => ({ getVolunteerAvailability: jest.fn() }));
const openRequestsMock = getOpenRequests as jest.MockedFunction<typeof getOpenRequests>;
const availabilityMock = getVolunteerAvailability as jest.MockedFunction<typeof getVolunteerAvailability>;

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

describe('availability windows', () => {
  it('merges back-to-back windows so a request spanning both matches', () => {
    const windows = buildAvailabilityWindows([availability({ id: 'a', startTime: '14:00', endTime: '16:00' }), availability({ id: 'b', startTime: '16:00', endTime: '18:00' })], now);
    expect(windows).toHaveLength(1);
    expect(matchRequestToWindows(request({ preferredTime: '3:30 PM', durationMinutes: 60 }), windows, now)).toMatchObject({ matches: true, reason: 'matched', matchedAvailabilityIds: ['a', 'b'] });
  });
  it('keeps separate windows apart when there is a gap', () => {
    const windows = buildAvailabilityWindows([availability({ id: 'a', startTime: '09:00', endTime: '11:00' }), availability({ id: 'b', startTime: '14:00', endTime: '17:00' })], now);
    expect(windows).toHaveLength(2);
    expect(matchRequestToWindows(request({ preferredTime: '12:00 PM' }), windows, now).reason).toBe('outside-window');
  });
  it('ignores windows that are withdrawn, invalid, or already over', () => {
    expect(buildAvailabilityWindows([
      availability({ id: 'withdrawn', isAvailable: false }),
      availability({ id: 'invalid', startTime: '17:00', endTime: '14:00' }),
      availability({ id: 'past', date: new Date(2026, 6, 1) }),
    ], now)).toEqual([]);
  });
});

describe('request classification', () => {
  const windows = () => [availability({ id: 'a' })];
  it('separates matches from the requests a volunteer cannot attend', () => {
    const fits = request({ id: 'fits' });
    const wrongTime = request({ id: 'wrong-time', preferredTime: '9:00 AM' });
    const wrongDay = request({ id: 'wrong-day', preferredDate: new Date(2026, 7, 26) });
    const result = classifyRequests([fits, wrongTime, wrongDay], windows(), now);
    expect(result.matched.map((entry) => entry.request.id)).toEqual(['fits']);
    expect(result.unmatched.map((entry) => [entry.request.id, entry.reason])).toEqual([['wrong-time', 'outside-window'], ['wrong-day', 'different-day']]);
    expect(result.hasAvailability).toBe(true);
  });
  it('excludes cancelled and completed requests entirely', () => {
    const result = classifyRequests([request({ id: 'cancelled', status: 'cancelled' }), request({ id: 'completed', status: 'completed' })], windows(), now);
    expect(result.matched).toEqual([]);
    expect(result.unmatched).toEqual([]);
  });
  it('reports every open request as unmatched when no availability is saved', () => {
    const result = classifyRequests([request()], [], now);
    expect(result.hasAvailability).toBe(false);
    expect(result.unmatched.map((entry) => entry.reason)).toEqual(['no-availability']);
  });
});

describe('matching API', () => {
  beforeEach(() => { openRequestsMock.mockReset(); availabilityMock.mockReset(); });

  it('returns matched and unmatched requests for the volunteer', async () => {
    openRequestsMock.mockResolvedValue([request({ id: 'fits' }), request({ id: 'wrong-time', preferredTime: '9:00 AM' })]);
    availabilityMock.mockResolvedValue([availability()]);
    const result = await getMatchedRequestsForVolunteer('volunteer-1', now);
    expect(result.matched.map((entry) => entry.request.id)).toEqual(['fits']);
    expect(result.unmatched.map((entry) => entry.request.id)).toEqual(['wrong-time']);
    expect(result).toMatchObject({ hasAvailability: true, availabilityUnavailable: false });
  });

  it('still lists every open request when availability cannot be loaded', async () => {
    openRequestsMock.mockResolvedValue([request()]);
    availabilityMock.mockRejectedValue(new Error('offline'));
    const result = await getMatchedRequestsForVolunteer('volunteer-1', now);
    expect(result).toMatchObject({ matched: [], hasAvailability: false, availabilityUnavailable: true });
    expect(result.unmatched).toHaveLength(1);
  });

  it('reports the match for a single request and stays quiet without availability', async () => {
    availabilityMock.mockResolvedValue([availability()]);
    expect(await getRequestMatchForVolunteer('volunteer-1', request(), now)).toMatchObject({ matches: true });
    availabilityMock.mockResolvedValue([]);
    expect(await getRequestMatchForVolunteer('volunteer-1', request(), now)).toBeNull();
    availabilityMock.mockRejectedValue(new Error('offline'));
    expect(await getRequestMatchForVolunteer('volunteer-1', request(), now)).toBeNull();
  });
});
