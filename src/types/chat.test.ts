import { canChatForStatus } from './chat';

describe('request chat eligibility', () => {
  it('allows messaging only while an assigned activity is active', () => {
    expect(canChatForStatus('accepted')).toBe(true);
    expect(canChatForStatus('scheduled')).toBe(true);
    expect(canChatForStatus('in_progress')).toBe(true);
    expect(canChatForStatus('pending')).toBe(false);
    expect(canChatForStatus('completed')).toBe(false);
    expect(canChatForStatus('cancelled')).toBe(false);
  });
});
