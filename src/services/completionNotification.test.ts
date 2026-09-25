import { buildCompletionMessage, completionRecipients, type CompletionNotificationContext } from '../types/notification';

const context: CompletionNotificationContext = {
  elderlyId: 'elderly-1',
  elderlyName: 'Margaret Perera',
  caregiverId: 'caregiver-1',
  requestId: 'request-1',
  activityType: 'Grocery Collection',
  volunteerId: 'volunteer-1',
  volunteerName: 'Nadia Fernando',
};

describe('completionRecipients', () => {
  it('notifies the elderly user, the volunteer, and the linked caregiver', () => {
    expect(completionRecipients(context)).toEqual([
      { userId: 'elderly-1', audience: 'elderly' },
      { userId: 'volunteer-1', audience: 'volunteer' },
      { userId: 'caregiver-1', audience: 'caregiver' },
    ]);
  });

  it('skips the caregiver when none is linked', () => {
    const recipients = completionRecipients({ ...context, caregiverId: undefined });
    expect(recipients.map((item) => item.audience)).toEqual(['elderly', 'volunteer']);
  });

  it('does not notify the elderly user twice when they are recorded as their own caregiver', () => {
    const recipients = completionRecipients({ ...context, caregiverId: 'elderly-1' });
    expect(recipients.filter((item) => item.userId === 'elderly-1')).toHaveLength(1);
  });
});

describe('buildCompletionMessage', () => {
  it('confirms to the elderly user that the visit was recorded', () => {
    const message = buildCompletionMessage(context, 'elderly');
    expect(message).toContain('Grocery Collection');
    expect(message).toContain('Nadia Fernando');
    expect(message).toContain('recorded');
  });

  it('thanks the volunteer', () => {
    expect(buildCompletionMessage(context, 'volunteer')).toContain('Thank you');
  });

  it('names the linked elderly user in the caregiver copy', () => {
    expect(buildCompletionMessage(context, 'caregiver')).toContain("Margaret Perera's");
  });

  it('reads naturally without a volunteer name', () => {
    expect(buildCompletionMessage({ ...context, volunteerName: undefined }, 'elderly')).toBe(
      'Your Grocery Collection visit has been completed and recorded.',
    );
  });
});
