import { buildVolunteerVerificationMessage } from '../types/notification';

describe('buildVolunteerVerificationMessage', () => {
  it('tells an approved volunteer they can now accept requests', () => {
    const message = buildVolunteerVerificationMessage({ volunteerId: 'vol-1', decision: 'approved' });
    expect(message).toContain('verified your volunteer profile');
    expect(message).toContain('accept companionship requests');
  });

  it('includes the administrator note as a reason when one was given', () => {
    const message = buildVolunteerVerificationMessage({ volunteerId: 'vol-1', decision: 'rejected', note: '  References incomplete  ' });
    expect(message).toContain('could not approve it');
    expect(message).toContain('Reason: References incomplete');
  });

  it('omits the reason when the note is blank', () => {
    expect(buildVolunteerVerificationMessage({ volunteerId: 'vol-1', decision: 'rejected', note: '   ' })).not.toContain('Reason');
  });
});
