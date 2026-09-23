import type { VolunteerAvailability } from '../types/volunteer';

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function minutes(value: string): number | null {
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** True for duplicate, contained, partial, and exact time overlaps on the same day. */
export function overlapsAvailability(
  candidate: Pick<VolunteerAvailability, 'date' | 'startTime' | 'endTime'>,
  existing: VolunteerAvailability[],
  excludedId?: string,
): boolean {
  const start = minutes(candidate.startTime);
  const end = minutes(candidate.endTime);
  if (start === null || end === null || end <= start) return false;
  return existing.some((entry) => {
    if (!entry.isAvailable || entry.id === excludedId || dateKey(entry.date) !== dateKey(candidate.date)) return false;
    const entryStart = minutes(entry.startTime);
    const entryEnd = minutes(entry.endTime);
    return entryStart !== null && entryEnd !== null && start < entryEnd && end > entryStart;
  });
}
