/// <reference types="jest" />
import { toVolunteerActivityHistoryItem } from './volunteerActivityHistoryRecords';

it('keeps completed and cancelled requests and reads legacy category/date fields', () => {
  const completedAt = new Date('2026-08-04T10:00:00Z');
  expect(toVolunteerActivityHistoryItem('a1', {
    status: 'completed', activityType: 'companionship', completedAt,
  })).toEqual({ id: 'a1', category: 'companionship', status: 'completed', activityDate: completedAt });

  const cancelledAt = new Date('2026-08-05T10:00:00Z');
  expect(toVolunteerActivityHistoryItem('a2', {
    status: 'cancelled', category: 'transport', cancelledAt,
  })).toEqual({ id: 'a2', category: 'transport', status: 'cancelled', activityDate: cancelledAt });
});

it('excludes non-terminal requests from activity history', () => {
  expect(toVolunteerActivityHistoryItem('a3', { status: 'accepted' })).toBeNull();
});
