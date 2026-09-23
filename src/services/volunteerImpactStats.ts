import type { CompanionshipRequest } from '../types/request';
import type { VolunteerImpact } from '../types/volunteer';

/** Impact is derived from completed assignments, never from a volunteer-editable counter. */
export function deriveVolunteerImpact(requests: readonly CompanionshipRequest[]): VolunteerImpact {
  const completed = requests.filter((request) => request.status === 'completed');
  const minutes = completed.reduce((total, request) => total + (request.durationMinutes && request.durationMinutes > 0 ? request.durationMinutes : 0), 0);
  return {
    completedActivities: completed.length,
    volunteerHours: minutes ? Math.round((minutes / 60) * 10) / 10 : 0,
    peopleSupported: new Set(completed.map((request) => request.createdBy).filter(Boolean)).size,
  };
}
