import type { ActivityStatus } from './feedback';
import { REQUEST_ACTIVITY_TYPES, type RequestActivityType } from './request';

/** A terminal request belonging to the signed-in volunteer. */
export interface VolunteerActivityHistoryItem {
  id: string;
  category: string;
  status: Extract<ActivityStatus, 'completed' | 'cancelled'>;
  /** The date the activity finished or was cancelled, with sensible request-date fallbacks. */
  activityDate?: Date;
}

export interface VolunteerPreferences {
  preferredActivityTypes: RequestActivityType[];
}

export type VolunteerVerificationStatus = 'verified' | 'pending' | 'rejected' | 'unverified';
/** Mirrors the canonical request lifecycle; withdrawal reopens the request as `pending`. */
export type VolunteerActivityStatus = 'accepted' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface VolunteerOpportunity {
  id: string;
  activityType: string;
  scheduledAt?: Date;
  durationMinutes?: number;
  generalLocation?: string;
  helpDescription?: string;
  status: string;
}

export interface VolunteerActivity extends VolunteerOpportunity {
  status: VolunteerActivityStatus;
}

export const VOLUNTEER_ACTIVITY_TYPES = REQUEST_ACTIVITY_TYPES;
export const VOLUNTEER_DURATION_PREFERENCES = ['30 minutes', '30–60 minutes', '1–2 hours', 'More than 2 hours', 'Flexible'] as const;

export interface VolunteerAvailability {
  id: string;
  volunteerId: string;
  date: Date;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  preferredActivityTypes?: string[];
  preferredDuration?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type CreateAvailabilityData = Pick<VolunteerAvailability, 'date' | 'startTime' | 'endTime' | 'preferredActivityTypes' | 'preferredDuration'>;
export type UpdateAvailabilityData = CreateAvailabilityData;

export interface VolunteerImpact {
  completedActivities?: number;
  volunteerHours?: number;
  peopleSupported?: number;
}

export interface VolunteerUpdate {
  id: string;
  message: string;
  createdAt?: Date;
}

export interface VolunteerDashboardData {
  verificationStatus: VolunteerVerificationStatus;
  impact: VolunteerImpact | null;
  opportunities: VolunteerOpportunity[];
  nextActivity: VolunteerActivity | null;
  availability: VolunteerAvailability | null;
  updates: VolunteerUpdate[];
}

export type VolunteerVerificationDecision = 'approved' | 'rejected';

/** A volunteer as the admin verification queue sees them. */
export interface VolunteerVerificationRow {
  uid: string;
  fullName: string;
  email: string;
  phone?: string;
  locality?: string;
  bio?: string;
  experience?: string;
  accountStatus: string;
  verificationStatus: VolunteerVerificationStatus;
  submittedAt?: Date;
  decidedAt?: Date;
  decidedByName?: string;
  decisionNote?: string;
}

/**
 * One immutable entry in the verification audit trail. Written on every
 * approve/reject so a decision can always be traced back to the admin who
 * made it, when, and why.
 */
export interface VolunteerVerificationRecord {
  id: string;
  volunteerId: string;
  volunteerName: string;
  decision: VolunteerVerificationDecision;
  adminId: string;
  adminName: string;
  note?: string;
  decidedAt?: Date;
}

export interface VolunteerVerificationDecisionInput {
  volunteerId: string;
  volunteerName: string;
  decision: VolunteerVerificationDecision;
  note?: string;
}
