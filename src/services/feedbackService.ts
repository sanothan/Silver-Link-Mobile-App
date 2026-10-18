import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit as queryLimit,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { assertCanSubmitFeedback, authorRoleFor, feedbackEligibleActivities } from './feedbackAccess';
import { assertCanReviewAllFeedback, filterFeedback } from './feedbackAdmin';
import type { FeedbackFilter } from './feedbackAdmin';
import { normaliseFeedbackDraft, validateFeedbackDraft } from './feedbackValidation';
import type { ReportViewer } from './reportAccess';
import type { ActivityStatus, ActivitySummary, FeedbackAuthorRole, FeedbackDraft, FeedbackRecord } from '../types/feedback';

const ACTIVITIES_COLLECTION = 'requests';
const FEEDBACK_COLLECTION = 'activityFeedback';

export class FeedbackValidationError extends Error {
  readonly errors: ReturnType<typeof validateFeedbackDraft>['errors'];

  constructor(errors: ReturnType<typeof validateFeedbackDraft>['errors']) {
    super('The feedback is missing required information.');
    this.name = 'FeedbackValidationError';
    this.errors = errors;
  }
}

export class ActivityNotFoundError extends Error {
  constructor() {
    super('This activity no longer exists.');
    this.name = 'ActivityNotFoundError';
  }
}

function asDate(value: unknown): Date | undefined {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  if (value instanceof Date) return value;
  return undefined;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asActivityStatus(value: unknown): ActivityStatus {
  return value === 'accepted' || value === 'in_progress' || value === 'completed' || value === 'cancelled'
    ? value
    : 'open';
}

function asAuthorRole(value: unknown): FeedbackAuthorRole {
  return value === 'elderly' || value === 'caregiver' || value === 'volunteer' ? value : 'other';
}

/**
 * Everyone named on the activity document, de-duplicated and with blanks dropped. The
 * field names mirror the ones the request screens write, and a stored `participantIds`
 * list is honoured as well so the check keeps working as the activity model grows.
 */
function asParticipantIds(data: Record<string, unknown>): string[] {
  const named = [data.elderlyId, data.caregiverId, data.volunteerId, data.requesterId, data.createdBy, data.acceptedBy];
  const stored = Array.isArray(data.participantIds) ? data.participantIds : [];
  const all = [...named, ...stored].map(asText).filter((id) => id.length > 0);
  return Array.from(new Set(all));
}

/**
 * One activity document as the app understands it. Exported so other features - the
 * volunteer rating service among them - read activities the same way rather than growing
 * a second, slightly different idea of what a request document means.
 */
export function toActivity(id: string, data: Record<string, unknown>): ActivitySummary {
  return {
    id,
    title: asText(data.title) || asText(data.activityType) || 'Activity request',
    status: asActivityStatus(data.status),
    participantIds: asParticipantIds(data),
    volunteerId: asText(data.volunteerId) || asText(data.acceptedBy) || null,
    elderlyId: asText(data.elderlyId) || asText(data.requesterId) || asText(data.createdBy) || null,
    completedAt: asDate(data.completedAt),
    createdAt: asDate(data.createdAt),
  };
}

function toFeedback(id: string, data: Record<string, unknown>): FeedbackRecord {
  const rating = typeof data.rating === 'number' ? data.rating : null;
  return {
    id,
    activityId: asText(data.activityId),
    activityTitle: asText(data.activityTitle),
    rating,
    comment: asText(data.comment),
    authorId: asText(data.authorId),
    authorRole: asAuthorRole(data.authorRole),
    createdAt: asDate(data.createdAt),
  };
}

/** A single activity, read so its status and participants can be checked. */
export async function getActivity(id: string): Promise<ActivitySummary> {
  if (!db) throw new Error('Firebase is not configured.');
  const snapshot = await getDoc(doc(db, ACTIVITIES_COLLECTION, id));
  if (!snapshot.exists()) throw new ActivityNotFoundError();
  return toActivity(snapshot.id, snapshot.data() as Record<string, unknown>);
}

/**
 * The completed activities the viewer took part in, newest first. This is the list the
 * form offers, which is why feedback can never be started for an unrelated activity.
 */
export async function getFeedbackEligibleActivities(viewer: ReportViewer | null): Promise<ActivitySummary[]> {
  if (!db || !viewer) return [];
  const snapshot = await getDocs(
    query(collection(db, ACTIVITIES_COLLECTION), where('status', '==', 'completed'), queryLimit(50)),
  );
  const activities = snapshot.docs.map((item) => toActivity(item.id, item.data() as Record<string, unknown>));
  return feedbackEligibleActivities(activities, viewer).sort(
    (a, b) =>
      (b.completedAt?.getTime() ?? b.createdAt?.getTime() ?? 0) -
      (a.completedAt?.getTime() ?? a.createdAt?.getTime() ?? 0),
  );
}

/** The feedback the viewer already left for an activity, so nobody comments twice. */
export async function getMyFeedbackForActivity(
  viewer: ReportViewer | null,
  activityId: string,
): Promise<FeedbackRecord | null> {
  if (!db || !viewer || !activityId) return null;
  const snapshot = await getDocs(
    query(
      collection(db, FEEDBACK_COLLECTION),
      where('activityId', '==', activityId),
      where('authorId', '==', viewer.uid),
      queryLimit(1),
    ),
  );
  const first = snapshot.docs[0];
  return first ? toFeedback(first.id, first.data() as Record<string, unknown>) : null;
}

/**
 * Administrator view of every piece of feedback members have submitted, newest first.
 *
 * The filter is applied in memory rather than as a Firestore query, so one read serves
 * every chip on the screen and the "needs attention" filter means exactly what
 * `feedbackAdmin` says it means. Sorting here too keeps the collection free of the
 * composite index an ordered, filtered query would otherwise require.
 */
export async function getFeedbackForAdmin(
  viewer: ReportViewer | null,
  filter: FeedbackFilter = 'all',
): Promise<FeedbackRecord[]> {
  if (!db) throw new Error('Firebase is not configured.');
  assertCanReviewAllFeedback(viewer);

  const snapshot = await getDocs(query(collection(db, FEEDBACK_COLLECTION), queryLimit(200)));
  const records = snapshot.docs.map((item) => toFeedback(item.id, item.data() as Record<string, unknown>));
  return filterFeedback(records, filter);
}

/** Every piece of feedback left on one activity, newest first. */
export async function getFeedbackForActivity(activityId: string): Promise<FeedbackRecord[]> {
  if (!db) throw new Error('Firebase is not configured.');
  const snapshot = await getDocs(
    query(collection(db, FEEDBACK_COLLECTION), where('activityId', '==', activityId), orderBy('createdAt', 'desc')),
  );
  return snapshot.docs.map((item) => toFeedback(item.id, item.data() as Record<string, unknown>));
}

/**
 * Validates and stores one piece of feedback against a completed activity.
 *
 * The activity is re-read here rather than trusted from the screen, and the eligibility
 * check runs against that fresh copy, so an activity that was reopened - or an id the
 * caller was never entitled to - is refused with FeedbackAccessError. The matching
 * Firestore rule enforces the same thing on the server.
 */
export async function submitActivityFeedback(draft: FeedbackDraft, viewer: ReportViewer | null): Promise<string> {
  if (!db) throw new Error('Firebase is not configured.');

  const result = validateFeedbackDraft(draft);
  if (!result.valid) throw new FeedbackValidationError(result.errors);

  const clean = normaliseFeedbackDraft(draft);
  const activity = await getActivity(clean.activityId);
  const existing = await getMyFeedbackForActivity(viewer, activity.id);
  assertCanSubmitFeedback(activity, viewer, existing);

  const created = await addDoc(collection(db, FEEDBACK_COLLECTION), {
    activityId: activity.id,
    activityTitle: activity.title,
    rating: clean.rating,
    comment: clean.comment,
    authorId: viewer.uid,
    authorRole: authorRoleFor(activity, viewer),
    createdAt: serverTimestamp(),
  });
  return created.id;
}
