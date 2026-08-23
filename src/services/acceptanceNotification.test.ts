import { buildAcceptanceMessage, type AcceptanceNotificationContext } from '../types/notification';

const context: AcceptanceNotificationContext = {
  elderlyId: 'elderly-1',
  elderlyName: 'Margaret Perera',
  caregiverId: 'caregiver-1',
  requestId: 'request-1',
  activityType: 'Grocery Collection',
  preferredDate: new Date(2026, 8, 3),
  preferredTime: '10:00 AM',
  volunteerId: 'volunteer-1',
  volunteerName: 'Nadia Fernando',
  volunteerVerified: true,
};

describe('buildAcceptanceMessage', () => {
  it('tells the elderly user who accepted and when they are coming', () => {
    const message = buildAcceptanceMessage(context, 'elderly');
    expect(message).toContain('Nadia Fernando');
    expect(message).toContain('verified volunteer');
    expect(message).toContain('Grocery Collection');
    expect(message).toContain('10:00 AM');
  });

  it('names the linked elderly user in the caregiver copy', () => {
    expect(buildAcceptanceMessage(context, 'caregiver')).toContain("Margaret Perera's");
  });

  it('omits the verified marker for an unverified volunteer', () => {
    expect(buildAcceptanceMessage({ ...context, volunteerVerified: false }, 'elderly')).not.toContain('verified volunteer');
  });
});
