export type RequestStatus = 'pending' | 'accepted' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface CompanionshipRequest {
  id: string;
  createdBy: string;
  createdByName?: string;
  caregiverId?: string;
  activityType: string;
  description?: string;
  preferredDate: Date;
  preferredTime: string;
  durationMinutes?: number;
  durationLabel?: string;
  location: string;
  latitude?: number;
  longitude?: number;
  status: RequestStatus;
  assignedVolunteerId?: string;
  volunteerName?: string;
  volunteerVerified?: boolean;
  volunteerPhotoUrl?: string;
  volunteerBio?: string;
  volunteerExperience?: string;
  volunteerRating?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export type RequestFormValues = Pick<CompanionshipRequest, 'activityType' | 'description' | 'preferredDate' | 'preferredTime' | 'durationMinutes' | 'durationLabel' | 'location' | 'latitude' | 'longitude'>;

export const EDITABLE_REQUEST_STATUSES: RequestStatus[] = ['pending', 'accepted'];
export const CANCELLABLE_REQUEST_STATUSES: RequestStatus[] = ['pending', 'accepted', 'scheduled'];

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  pending: 'Looking for a volunteer', accepted: 'Volunteer found', scheduled: 'Visit scheduled',
  in_progress: 'Visit in progress', completed: 'Completed', cancelled: 'Cancelled',
};
