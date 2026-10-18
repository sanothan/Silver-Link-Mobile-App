/// <reference types="jest" />
import { deriveVolunteerImpact } from './volunteerImpactStats';

it('derives completed activities, hours, and unique people from real completed requests', () => {
  expect(deriveVolunteerImpact([
    { id: '1', createdBy: 'elder-1', status: 'completed', durationMinutes: 90 },
    { id: '2', createdBy: 'elder-1', status: 'completed', durationMinutes: 30 },
    { id: '3', createdBy: 'elder-2', status: 'completed' },
    { id: '4', createdBy: 'elder-3', status: 'scheduled', durationMinutes: 60 },
  ] as any)).toEqual({ completedActivities: 3, volunteerHours: 2, peopleSupported: 2 });
});
