import { doesRequestMatchActivityInterest, doesRequestMatchAvailability, findScheduleConflict, getMatchingRequestIds, isScheduleWithinAvailability, rankRequestsByMatch } from './requestMatchingService';
import { normalizeActivityTypes, REQUEST_ACTIVITY_TYPES } from '../types/request';
import { VOLUNTEER_ACTIVITY_TYPES } from '../types/volunteer';
import { EMPTY_FILTERS, matchesFilters } from '../components/RequestFilterModal';
import type { CompanionshipRequest } from '../types/request';
import type { VolunteerAvailability } from '../types/volunteer';

const now = new Date(2026, 7, 1, 8, 0);
const request = (overrides: Partial<CompanionshipRequest> = {}): CompanionshipRequest => ({ id: 'request-1', createdBy: 'elderly-1', activityType: 'Friendly Conversation', preferredDate: new Date(2026, 7, 25), preferredTime: '3:00 PM', durationMinutes: 60, location: 'Colombo 05', status: 'pending', ...overrides });
const availability = (overrides: Partial<VolunteerAvailability> = {}): VolunteerAvailability => ({ id: 'availability-1', volunteerId: 'volunteer-1', date: new Date(2026, 7, 25), startTime: '14:00', endTime: '17:00', isAvailable: true, ...overrides });

describe('activity-interest matching', () => {
  it('uses the request creation activity types for volunteer choices', () => {
    expect(VOLUNTEER_ACTIVITY_TYPES).toBe(REQUEST_ACTIVITY_TYPES);
  });
  it('matches a single or any of multiple interests, with safe legacy normalization', () => {
    expect(doesRequestMatchActivityInterest(request(), ['Friendly Conversation'])).toBe(true);
    expect(doesRequestMatchActivityInterest(request({ activityType: ' smartphone HELP ' }), ['Walking Companionship', 'Smartphone Help'])).toBe(true);
    expect(doesRequestMatchActivityInterest(request({ activityType: 'Medicine Collection' }), ['Friendly Conversation'])).toBe(false);
    expect(doesRequestMatchActivityInterest(request(), [])).toBe(false);
    expect(normalizeActivityTypes(['Friendly Conversation', ' friendly conversation ', null, 'Friendly Chat'])).toEqual(['Friendly Conversation']);
    expect(doesRequestMatchActivityInterest(request({ activityType: 'Friendly Chat' }), ['Friendly Chat'])).toBe(false);
  });
  it.each(['accepted', 'scheduled', 'in_progress', 'completed', 'cancelled'] as const)('excludes %s requests', (status) => {
    expect(doesRequestMatchActivityInterest(request({ status }), ['Friendly Conversation'])).toBe(false);
  });
  it('excludes requests already assigned even if pending', () => {
    expect(doesRequestMatchActivityInterest(request({ assignedVolunteerId: 'another' }), ['Friendly Conversation'])).toBe(false);
  });
  it('ranks both matches, interest only, availability only, and other once per ID', () => {
    const both = request({ id: 'both' });
    const rows = [request({ id: 'other', activityType: 'Other' }), request({ id: 'time', activityType: 'Grocery Collection' }), request({ id: 'interest' }), both, both];
    const ranked = rankRequestsByMatch(rows, ['Friendly Conversation'], new Set(['both', 'time']));
    expect(ranked.map((item) => item.request.id)).toEqual(['both', 'interest', 'time', 'other']);
    expect(ranked[0]).toMatchObject({ interestMatch: true, availabilityMatch: true });
  });
  it('preserves all available requests with no interests and recalculates after edits', () => {
    const rows = [request(), request({ id: 'medicine', activityType: 'Medicine Collection' })];
    expect(rankRequestsByMatch(rows, [], new Set())).toHaveLength(2);
    expect(rankRequestsByMatch(rows, ['Medicine Collection'], new Set())[0].request.id).toBe('medicine');
    expect(rankRequestsByMatch(rows, ['Friendly Conversation'], new Set())[0].request.id).toBe('request-1');
    expect(rankRequestsByMatch([request({ status: 'accepted' })], ['Friendly Conversation'], new Set())).toEqual([]);
  });
  it('keeps manual filters independent of saved interests and combines availability filters', () => {
    const rows = [request(), request({ id: 'walk', activityType: 'Walking Companionship' })];
    const interests = ['Friendly Conversation'];
    const availabilityIds = new Set(['walk']);
    const filtered = rows.filter((item) => matchesFilters(item, { ...EMPTY_FILTERS, activityTypes: ['Walking Companionship'], availabilityMatch: true }, availabilityIds));
    expect(rankRequestsByMatch(filtered, interests, availabilityIds)).toEqual([
      { request: rows[1], interestMatch: false, availabilityMatch: true },
    ]);
    expect(interests).toEqual(['Friendly Conversation']);
  });
});

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

describe('reschedule validation', () => {
  const proposed = request({ id: 'rescheduled', status: 'scheduled', preferredTime: '3:00 PM' });

  it('requires the entire rescheduled activity to fit a saved availability window', () => {
    expect(isScheduleWithinAvailability(proposed, [availability()], now)).toBe(true);
    expect(isScheduleWithinAvailability(
      proposed,
      [availability({ endTime: '15:30' })],
      now,
    )).toBe(false);
  });

  it('detects active overlaps but permits touching endpoints and terminal activities', () => {
    expect(findScheduleConflict(proposed, [
      request({ id: 'overlap', status: 'accepted', preferredTime: '3:30 PM' }),
    ])?.id).toBe('overlap');
    expect(findScheduleConflict(proposed, [
      request({ id: 'touching', status: 'scheduled', preferredTime: '4:00 PM' }),
      request({ id: 'completed', status: 'completed', preferredTime: '3:30 PM' }),
    ])).toBeUndefined();
  });
});
