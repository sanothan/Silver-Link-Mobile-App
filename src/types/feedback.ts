/**
 * "Submit Activity Feedback" - the types shared by the feedback form, the access
 * checks, and the Firestore service.
 */

/**
 * The statuses an activity request can be in. Only `completed` opens feedback, which is
 * what keeps feedback tied to work that actually happened.
 */
export type ActivityStatus = 'open' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';

export const COMPLETED_ACTIVITY_STATUS: ActivityStatus = 'completed';

export const ACTIVITY_STATUS_LABEL: Record<ActivityStatus, string> = {
  open: 'Waiting for a volunteer',
  accepted: 'Volunteer assigned',
  in_progress: 'Happening now',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/** How the person giving feedback took part, kept so admins can read the comment in context. */
export type FeedbackAuthorRole = 'elderly' | 'caregiver' | 'volunteer' | 'other';

/**
 * An activity as the feedback screen needs it: enough to decide who may comment on it and
 * enough to show the person which activity they are commenting on.
 */
export interface ActivitySummary {
  id: string;
  title: string;
  status: ActivityStatus;
  /**
   * Everyone who took part - the elderly member, their caregiver, and the volunteer.
   * Gathered from the activity document, and the only people allowed to leave feedback.
   */
  participantIds: string[];
  /** Firestore id of the volunteer who carried the activity out, when one was assigned. */
  volunteerId: string | null;
  /** Firestore id of the elderly member the activity was for. */
  elderlyId: string | null;
  completedAt?: Date;
  createdAt?: Date;
}

/** The star rating, kept optional so a comment alone is always enough to submit. */
export const RATING_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'Poor' },
  { value: 2, label: 'Fair' },
  { value: 3, label: 'Good' },
  { value: 4, label: 'Very good' },
  { value: 5, label: 'Excellent' },
];

/** What the feedback form collects, before it reaches Firestore. */
export interface FeedbackDraft {
  activityId: string;
  /** 1-5, or null when the person only wants to leave a comment. */
  rating: number | null;
  comment: string;
}

/** A stored piece of feedback, always linked to one completed activity. */
export interface FeedbackRecord {
  id: string;
  /** Firestore id of the `requests` document this feedback is about. */
  activityId: string;
  /** The activity title captured at submission time, so the record reads on its own. */
  activityTitle: string;
  rating: number | null;
  comment: string;
  /** Firestore id of the person who wrote the feedback. */
  authorId: string;
  authorRole: FeedbackAuthorRole;
  createdAt?: Date;
}
