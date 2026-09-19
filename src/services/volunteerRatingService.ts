import { collection, doc, getDoc, getDocs, limit as queryLimit, query, setDoc, serverTimestamp, where } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { getActivity, toActivity } from './feedbackService';
import type { ReportViewer } from './reportAccess';
import { assertCanRateVolunteer, raterRoleFor, rateableActivities } from './volunteerRatingAccess';
import { emptyVolunteerRatingSummary, summariseVolunteerRatings } from './volunteerRatingSummary';
import { normaliseVolunteerRatingDraft, validateVolunteerRatingDraft } from './volunteerRatingValidation';
import type { ActivitySummary } from '../types/feedback';
import type { RaterRole, VolunteerRatingDraft, VolunteerRatingRecord, VolunteerRatingSummary } from '../types/volunteerRating';

const ACTIVITIES_COLLECTION = 'requests';
const RATINGS_COLLECTION = 'volunteerRatings';

export class VolunteerRatingValidationError extends Error {
  readonly errors: ReturnType<typeof validateVolunteerRatingDraft>['errors'];

  constructor(errors: ReturnType<typeof validateVolunteerRatingDraft>['errors']) {
    super('The rating is missing required information.');
    this.name = 'VolunteerRatingValidationError';
    this.errors = errors;
  }
}

/**
 * One rating per rater per activity, expressed as the document id.
 *
 * This is what actually prevents duplicates: a second submission targets the same
 * document, and the Firestore rule allows create but never update, so the write is
 * refused by the server even if two devices race. The eligibility check below is the
 * friendly half; this is the half that cannot be talked around.
 */
export function ratingDocId(activityId: string, raterId: string): string {
  return `${activityId}__${raterId}`;
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

function asRaterRole(value: unknown): RaterRole {
  return value === 'elderly' || value === 'caregiver' ? value : 'other';
}

function toRating(id: string, data: Record<string, unknown>): VolunteerRatingRecord {
  return {
    id,
    activityId: asText(data.activityId),
    activityTitle: asText(data.activityTitle),
    volunteerId: asText(data.volunteerId),
    score: typeof data.score === 'number' ? data.score : 0,
    comment: asText(data.comment),
    raterId: asText(data.raterId),
    raterRole: asRaterRole(data.raterRole),
    createdAt: asDate(data.createdAt),
  };
}

/**
 * The completed activities whose volunteer the viewer may rate, newest first. This is the
 * list the form offers, so an activity they had nothing to do with is never on screen.
 */
export async function getRateableActivities(viewer: ReportViewer | null): Promise<ActivitySummary[]> {
  if (!db || !viewer) return [];
  const snapshot = await getDocs(
    query(collection(db, ACTIVITIES_COLLECTION), where('status', '==', 'completed'), queryLimit(50)),
  );
  const activities = snapshot.docs.map((item) => toActivity(item.id, item.data() as Record<string, unknown>));
  return rateableActivities(activities, viewer).sort(
    (a, b) =>
      (b.completedAt?.getTime() ?? b.createdAt?.getTime() ?? 0) -
      (a.completedAt?.getTime() ?? a.createdAt?.getTime() ?? 0),
  );
}

/** The rating this viewer already gave for an activity, if any, read by its exact id. */
export async function getMyRatingForActivity(
  viewer: ReportViewer | null,
  activityId: string,
): Promise<VolunteerRatingRecord | null> {
  if (!db || !viewer || !activityId) return null;
  const snapshot = await getDoc(doc(db, RATINGS_COLLECTION, ratingDocId(activityId, viewer.uid)));
  return snapshot.exists() ? toRating(snapshot.id, snapshot.data() as Record<string, unknown>) : null;
}

/** Every rating a volunteer has received. */
export async function getRatingsForVolunteer(volunteerId: string): Promise<VolunteerRatingRecord[]> {
  if (!db || !volunteerId) return [];
  const snapshot = await getDocs(
    query(collection(db, RATINGS_COLLECTION), where('volunteerId', '==', volunteerId)),
  );
  return snapshot.docs.map((item) => toRating(item.id, item.data() as Record<string, unknown>));
}

/**
 * A volunteer's rating summary, recalculated from the stored ratings rather than read
 * from a running total, so it cannot drift away from the ratings people actually gave.
 */
export async function getVolunteerRatingSummary(volunteerId: string): Promise<VolunteerRatingSummary> {
  if (!volunteerId) return emptyVolunteerRatingSummary(volunteerId);
  const ratings = await getRatingsForVolunteer(volunteerId);
  return summariseVolunteerRatings(volunteerId, ratings);
}

/**
 * Validates and stores one rating of the volunteer who carried out a completed activity.
 *
 * The activity is re-read here rather than trusted from the screen, and the eligibility
 * check runs against that fresh copy, so an activity that was reopened - or an id the
 * caller was never entitled to - is refused with VolunteerRatingAccessError. The matching
 * Firestore rule enforces the same thing on the server.
 */
export async function rateVolunteer(draft: VolunteerRatingDraft, viewer: ReportViewer | null): Promise<string> {
  if (!db) throw new Error('Firebase is not configured.');

  const result = validateVolunteerRatingDraft(draft);
  if (!result.valid) throw new VolunteerRatingValidationError(result.errors);

  const clean = normaliseVolunteerRatingDraft(draft);
  const activity = await getActivity(clean.activityId);
  const existing = await getMyRatingForActivity(viewer, activity.id);
  assertCanRateVolunteer(activity, viewer, existing);

  const id = ratingDocId(activity.id, viewer.uid);
  await setDoc(doc(db, RATINGS_COLLECTION, id), {
    activityId: activity.id,
    activityTitle: activity.title,
    volunteerId: activity.volunteerId,
    score: clean.score,
    comment: clean.comment,
    raterId: viewer.uid,
    raterRole: raterRoleFor(activity, viewer),
    createdAt: serverTimestamp(),
  });
  return id;
}
