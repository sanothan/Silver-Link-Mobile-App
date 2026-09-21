import type { VolunteerActivityHistoryItem } from '../types/volunteer';

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asDate(value: unknown): Date | undefined {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return value instanceof Date ? value : undefined;
}

/** Reduces a request document to the information a volunteer may see in their own history. */
export function toVolunteerActivityHistoryItem(
  id: string,
  data: Record<string, unknown>,
): VolunteerActivityHistoryItem | null {
  const status = asText(data.status).trim().toLowerCase();
  if (status !== 'completed' && status !== 'cancelled') return null;

  return {
    id,
    category: asText(data.category) || asText(data.activityType) || asText(data.type),
    status,
    activityDate:
      asDate(status === 'completed' ? data.completedAt : data.cancelledAt) ??
      asDate(data.activityDate) ??
      asDate(data.scheduledAt) ??
      asDate(data.createdAt),
  };
}
