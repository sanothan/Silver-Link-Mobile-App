import { collection, getDocs, limit as queryLimit, query, where } from 'firebase/firestore';

import { db } from './firebaseConfig';
import type { ReportViewer } from './reportAccess';
import type { VolunteerActivityHistoryItem } from '../types/volunteer';
import { toVolunteerActivityHistoryItem } from './volunteerActivityHistoryRecords';

const ACTIVITIES_COLLECTION = 'requests';

/**
 * Gets terminal activities for the current volunteer only. The UID always comes from the
 * authenticated viewer; callers cannot supply a volunteer ID. `acceptedBy` is included
 * for requests created before `volunteerId` became the preferred assignment field.
 */
export async function getMyVolunteerActivityHistory(
  viewer: ReportViewer | null,
): Promise<VolunteerActivityHistoryItem[]> {
  if (!db || !viewer || viewer.role !== 'volunteer') return [];

  const activities = collection(db, ACTIVITIES_COLLECTION);
  const [byVolunteerId, byAcceptedBy] = await Promise.all([
    getDocs(query(activities, where('volunteerId', '==', viewer.uid), queryLimit(100))),
    getDocs(query(activities, where('acceptedBy', '==', viewer.uid), queryLimit(100))),
  ]);

  const unique = new Map<string, VolunteerActivityHistoryItem>();
  for (const snapshot of [...byVolunteerId.docs, ...byAcceptedBy.docs]) {
    const item = toVolunteerActivityHistoryItem(snapshot.id, snapshot.data() as Record<string, unknown>);
    if (item) unique.set(item.id, item);
  }
  return [...unique.values()].sort(
    (a, b) => (b.activityDate?.getTime() ?? 0) - (a.activityDate?.getTime() ?? 0),
  );
}
