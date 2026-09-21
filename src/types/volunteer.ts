import type { ActivityStatus } from './feedback';

/** A terminal request belonging to the signed-in volunteer. */
export interface VolunteerActivityHistoryItem {
  id: string;
  category: string;
  status: Extract<ActivityStatus, 'completed' | 'cancelled'>;
  /** The date the activity finished or was cancelled, with sensible request-date fallbacks. */
  activityDate?: Date;
}
