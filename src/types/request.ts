/** The canonical activity-type values a request can be created and filtered with — kept in one place so the request form and the browse filter never drift apart. */
export const REQUEST_ACTIVITY_TYPES = [
  "Friendly Conversation",
  "Walking Companionship",
  "Smartphone Help",
  "Grocery Collection",
  "Medicine Collection",
  "Online Service Help",
  "Appointment Companionship",
  "Other",
] as const;

/** The canonical duration options a request can be created and filtered with. */
export const REQUEST_DURATION_OPTIONS = [
  { label: "30 minutes", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "1–2 hours", minutes: 90 },
  { label: "Flexible", minutes: undefined },
] as const;

export type RequestStatus =
  | "pending"
  | "accepted"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled";

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

export type RequestFormValues = Pick<
  CompanionshipRequest,
  | "activityType"
  | "description"
  | "preferredDate"
  | "preferredTime"
  | "durationMinutes"
  | "durationLabel"
  | "location"
  | "latitude"
  | "longitude"
>;

export const EDITABLE_REQUEST_STATUSES: RequestStatus[] = [
  "pending",
  "accepted",
];
export const CANCELLABLE_REQUEST_STATUSES: RequestStatus[] = [
  "pending",
  "accepted",
  "scheduled",
];

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  pending: "Looking for a volunteer",
  accepted: "Volunteer found",
  scheduled: "Visit scheduled",
  in_progress: "Visit in progress",
  completed: "Completed",
  cancelled: "Cancelled",
};
