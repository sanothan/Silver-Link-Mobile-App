export type VolunteerVerificationStatus = 'verified' | 'pending' | 'rejected' | 'unverified';
export type VolunteerActivityStatus = 'accepted' | 'scheduled' | 'ready_to_start' | 'in_progress' | 'completed' | 'cancelled';

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

export interface VolunteerAvailability {
  label: string;
}

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
