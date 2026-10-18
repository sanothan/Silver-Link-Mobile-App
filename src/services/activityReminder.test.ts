import {
  activityStartsAt,
  dueActivityReminders,
  isReminderDue,
  reminderNotificationId,
  REMINDER_LEAD_MINUTES,
} from './activityReminderService';
import { buildActivityReminderMessage, type ActivityReminderContext } from '../types/notification';
import type { CompanionshipRequest } from '../types/request';

const now = new Date(2026, 7, 24, 14, 0);
const request = (overrides: Partial<CompanionshipRequest> = {}): CompanionshipRequest => ({
  id: 'request-1',
  createdBy: 'elderly-1',
  createdByName: 'Margaret Perera',
  caregiverId: 'caregiver-1',
  activityType: 'Grocery Collection',
  preferredDate: new Date(2026, 7, 25),
  preferredTime: '10:00 AM',
  location: 'Colombo 05',
  status: 'scheduled',
  assignedVolunteerId: 'volunteer-1',
  volunteerName: 'Nadia Fernando',
  ...overrides,
});

describe('reminder scheduling', () => {
  it('reads the start instant from the stored date and time', () => {
    expect(activityStartsAt(request())).toEqual(new Date(2026, 7, 25, 10, 0));
  });

  it('generates a reminder for an upcoming scheduled activity', () => {
    expect(isReminderDue(request(), now)).toBe(true);
  });

  it('waits until the activity is inside the reminder window', () => {
    const farOff = request({ preferredDate: new Date(2026, 7, 27) });
    expect(isReminderDue(farOff, now)).toBe(false);
    const minutesAway = (activityStartsAt(farOff)!.getTime() - now.getTime()) / 60000;
    expect(minutesAway).toBeGreaterThan(REMINDER_LEAD_MINUTES);
  });

  it('never reminds about a cancelled activity', () => {
    expect(isReminderDue(request({ status: 'cancelled' }), now)).toBe(false);
  });

  it('never reminds about an activity that is not confirmed or is already over', () => {
    expect(isReminderDue(request({ status: 'pending', assignedVolunteerId: undefined }), now)).toBe(false);
    expect(isReminderDue(request({ status: 'completed' }), now)).toBe(false);
    expect(isReminderDue(request({ preferredDate: new Date(2026, 7, 23) }), now)).toBe(false);
  });
});

describe('reminder recipients', () => {
  it('reaches the elderly user, the volunteer, and the linked caregiver', () => {
    const reminders = dueActivityReminders([request()], now);
    expect(reminders.map((item) => `${item.audience}:${item.userId}`)).toEqual([
      'elderly:elderly-1',
      'volunteer:volunteer-1',
      'caregiver:caregiver-1',
    ]);
  });

  it('omits the caregiver when the elderly user has none linked', () => {
    const reminders = dueActivityReminders([request({ caregiverId: undefined })], now);
    expect(reminders.map((item) => item.audience)).toEqual(['elderly', 'volunteer']);
  });

  it('prevents duplicates by addressing one stable document per recipient', () => {
    const first = dueActivityReminders([request()], now);
    const later = dueActivityReminders([request()], new Date(2026, 7, 25, 8, 0));
    expect(later.map((item) => item.notificationId)).toEqual(first.map((item) => item.notificationId));
    expect(new Set(first.map((item) => item.notificationId)).size).toBe(3);
    expect(first[0].notificationId).toBe(reminderNotificationId('request-1', 'elderly', 'elderly-1'));
  });
});

describe('buildActivityReminderMessage', () => {
  const context: ActivityReminderContext = {
    elderlyId: 'elderly-1',
    elderlyName: 'Margaret Perera',
    caregiverId: 'caregiver-1',
    requestId: 'request-1',
    activityType: 'Grocery Collection',
    preferredDate: new Date(2026, 7, 25),
    preferredTime: '10:00 AM',
    volunteerId: 'volunteer-1',
    volunteerName: 'Nadia Fernando',
  };

  it.each(['elderly', 'volunteer', 'caregiver'] as const)('states the date and time to the %s user', (audience) => {
    const message = buildActivityReminderMessage(context, audience);
    expect(message).toContain('August');
    expect(message).toContain('25');
    expect(message).toContain('10:00 AM');
  });

  it('names the volunteer for the elderly user and the elderly user for the caregiver', () => {
    expect(buildActivityReminderMessage(context, 'elderly')).toContain('Nadia Fernando');
    expect(buildActivityReminderMessage(context, 'caregiver')).toContain("Margaret Perera's");
  });
});
