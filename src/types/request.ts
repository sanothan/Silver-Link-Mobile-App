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

export type RequestActivityType = typeof REQUEST_ACTIVITY_TYPES[number];

/** Accept legacy capitalization/whitespace, but never guess a different activity. */
export function normalizeActivityTypes(values: unknown): RequestActivityType[] {
  if (!Array.isArray(values)) return [];
  const normalized = values.filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim().toLowerCase());
  return REQUEST_ACTIVITY_TYPES.filter((activity) => normalized.includes(activity.toLowerCase()));
}

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
  acceptedAt?: Date;
  elderConfirmedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancelledBy?: string;
  rescheduledAt?: Date;
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
  "scheduled",
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

export const REQUEST_LIFECYCLE_STAGES = [
  { key: "pending", label: "Request Submitted" },
  { key: "accepted", label: "Volunteer Found" },
  { key: "scheduled", label: "Visit Scheduled" },
  { key: "in_progress", label: "Visit In Progress" },
  { key: "completed", label: "Completed" },
] as const satisfies readonly { key: RequestStatus; label: string }[];

export function requestLifecycleProgress(status: RequestStatus): number {
  if (status === "cancelled") return -1;
  return REQUEST_LIFECYCLE_STAGES.findIndex((stage) => stage.key === status);
}
