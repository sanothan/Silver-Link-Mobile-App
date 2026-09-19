/**
 * "Rate Volunteer" - the types shared by the rating form, the access checks, the summary
 * calculation, and the Firestore service.
 *
 * A rating is about the *volunteer* who carried out a completed activity, which is what
 * separates it from activity feedback: feedback judges how the activity went, a rating
 * says whether this volunteer is someone to trust again.
 */

import { RATING_OPTIONS } from './feedback';

/**
 * The agreed scale: 1-5, with a word for each step so an older user never has to guess
 * what four stars means. Shared with activity feedback on purpose - two different scales
 * in one app would be two different things to learn.
 */
export const VOLUNTEER_RATING_SCALE = RATING_OPTIONS;

export const MIN_VOLUNTEER_RATING = 1;
export const MAX_VOLUNTEER_RATING = 5;

/** How the person giving the rating took part, kept so the rating can be read in context. */
export type RaterRole = 'elderly' | 'caregiver' | 'other';

/** What the rating form collects, before it reaches Firestore. */
export interface VolunteerRatingDraft {
  activityId: string;
  /** 1-5. Unlike a feedback comment, the score is the whole point, so it is required. */
  score: number | null;
  /** Optional in the rater's own words; a score alone is always enough to submit. */
  comment: string;
}

/** A stored rating: one volunteer, one activity, one rater. */
export interface VolunteerRatingRecord {
  id: string;
  /** Firestore id of the `requests` document the rating is about. */
  activityId: string;
  /** The activity title captured at submission time, so the record reads on its own. */
  activityTitle: string;
  /** Firestore id of the volunteer being rated. */
  volunteerId: string;
  score: number;
  comment: string;
  /** Firestore id of the person who gave the rating. */
  raterId: string;
  raterRole: RaterRole;
  createdAt?: Date;
}

/**
 * A volunteer's reputation, derived from their ratings. `average` is rounded to one
 * decimal for display; `distribution` counts how many ratings landed on each score.
 */
export interface VolunteerRatingSummary {
  volunteerId: string;
  /** How many ratings the average is based on. Zero means the volunteer is unrated. */
  count: number;
  /** Mean score rounded to one decimal place, or null while the volunteer is unrated. */
  average: number | null;
  /** Counts keyed by score, always carrying every step of the scale. */
  distribution: Record<number, number>;
}

export function emptyVolunteerRatingDraft(activityId = ''): VolunteerRatingDraft {
  return { activityId, score: null, comment: '' };
}
