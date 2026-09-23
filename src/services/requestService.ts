import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    query,
    runTransaction,
    serverTimestamp,
    Timestamp,
    updateDoc,
    where,
    type DocumentData,
} from "firebase/firestore";
import type {
    CompanionshipRequest,
    RequestFormValues,
    RequestStatus,
} from "../types/request";
import { auth, db } from "./firebaseConfig";
import {
    createAcceptanceNotifications,
    createRescheduleNotifications,
    createScheduleConfirmationNotifications,
    createStatusNotification,
    writeWithdrawalNotifications,
} from "./notificationService";
import { getUserProfile } from "./userService";
import {
  findScheduleConflict,
  isScheduleWithinAvailability,
  type ScheduledActivity,
} from "./requestMatchingService";
import { getVolunteerAvailability } from "./volunteerAvailabilityService";

function requireDb() {
  if (!db) throw new Error("Firebase is not configured.");
  return db;
}
function asDate(value: unknown): Date | undefined {
  return value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
    ? value.toDate()
    : undefined;
}

/** Newest meaningful lifecycle change first, with id as a stable tie-breaker. */
export function compareRequestsNewestFirst(
  left: CompanionshipRequest,
  right: CompanionshipRequest,
): number {
  const finalTimestamp = (request: CompanionshipRequest) =>
    (request.status === "completed" ? request.completedAt : undefined)?.getTime()
    ?? (request.status === "cancelled" ? request.cancelledAt : undefined)?.getTime()
    ?? request.updatedAt?.getTime()
    ?? request.createdAt?.getTime()
    ?? 0;
  return finalTimestamp(right) - finalTimestamp(left)
    || left.id.localeCompare(right.id);
}
function asText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
const STATUSES: RequestStatus[] = [
  "pending",
  "accepted",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
];

function fromSnapshot(snapshot: {
  id: string;
  data(): DocumentData | undefined;
}): CompanionshipRequest {
  const data = snapshot.data();
  if (!data) throw new Error("Request not found.");
  const status = STATUSES.includes(data.status) ? data.status : "pending";
  return {
    id: snapshot.id,
    createdBy: asText(data.createdBy) ?? "",
    createdByName: asText(data.createdByName),
    caregiverId: asText(data.caregiverId),
    activityType: asText(data.activityType) ?? "Community support",
    description: asText(data.description),
    preferredDate:
      asDate(data.preferredDate) ?? asDate(data.scheduledAt) ?? new Date(),
    preferredTime: asText(data.preferredTime) ?? "",
    durationMinutes:
      typeof data.durationMinutes === "number"
        ? data.durationMinutes
        : undefined,
    durationLabel: asText(data.durationLabel),
    location: asText(data.location) ?? asText(data.generalLocation) ?? "",
    latitude: typeof data.latitude === "number" ? data.latitude : undefined,
    longitude: typeof data.longitude === "number" ? data.longitude : undefined,
    status,
    assignedVolunteerId: asText(data.assignedVolunteerId),
    volunteerName: asText(data.volunteerName),
    volunteerVerified: data.volunteerVerified === true,
    volunteerPhotoUrl: asText(data.volunteerPhotoUrl),
    volunteerBio: asText(data.volunteerBio),
    volunteerExperience: asText(data.volunteerExperience),
    volunteerRating:
      typeof data.volunteerRating === "number"
        ? data.volunteerRating
        : undefined,
    createdAt: asDate(data.createdAt),
    acceptedAt: asDate(data.acceptedAt),
    elderConfirmedAt: asDate(data.elderConfirmedAt),
    startedAt: asDate(data.startedAt),
    completedAt: asDate(data.completedAt),
    cancelledAt: asDate(data.cancelledAt),
    cancelledBy: asText(data.cancelledBy),
    rescheduledAt: asDate(data.rescheduledAt),
    updatedAt: asDate(data.updatedAt),
  };
}

export async function createRequest(uid: string, values: RequestFormValues) {
  const database = requireDb();
  const owner = await getUserProfile(uid).catch(() => null);
  // Denormalised so an accepting volunteer can notify the right people without
  // needing read access to the elderly user's profile.
  const result = await addDoc(collection(database, "requests"), {
    createdBy: uid,
    createdByName: owner?.fullName ?? null,
    caregiverId: owner?.caregiverId ?? null,
    activityType: values.activityType,
    description: values.description?.trim() || null,
    preferredDate: Timestamp.fromDate(values.preferredDate),
    preferredTime: values.preferredTime,
    durationMinutes: values.durationMinutes ?? null,
    durationLabel: values.durationLabel ?? null,
    location: values.location.trim(),
    latitude: values.latitude ?? null,
    longitude: values.longitude ?? null,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return result.id;
}

export async function getElderlyRequests(uid: string) {
  const database = requireDb();
  const snapshot = await getDocs(
    query(collection(database, "requests"), where("createdBy", "==", uid)),
  );
  return snapshot.docs
    .map(fromSnapshot)
    .sort(compareRequestsNewestFirst);
}

export async function getRequestById(requestId: string, uid: string) {
  const snapshot = await getDoc(doc(requireDb(), "requests", requestId));
  if (!snapshot.exists()) throw new Error("Request not found.");
  const request = fromSnapshot(snapshot);
  if (request.createdBy !== uid)
    throw new Error("You cannot access this request.");
  return request;
}

export async function updateRequest(
  requestId: string,
  uid: string,
  values: RequestFormValues,
) {
  const current = await getRequestById(requestId, uid);
  if (!["pending", "accepted", "scheduled"].includes(current.status))
    throw new Error("This request can no longer be edited.");
  const scheduleChanged =
    current.preferredDate.getTime() !== values.preferredDate.getTime() ||
    current.preferredTime !== values.preferredTime;
  if (current.status === "scheduled" && !scheduleChanged)
    throw new Error("Please choose a different date or time to reschedule.");

  if (scheduleChanged && current.assignedVolunteerId) {
    const proposed: ScheduledActivity = {
      id: requestId,
      preferredDate: values.preferredDate,
      preferredTime: values.preferredTime,
      durationMinutes: values.durationMinutes,
      status: current.status,
    };
    const [availability, assignedRequests] = await Promise.all([
      getVolunteerAvailability(current.assignedVolunteerId),
      getElderlyRequests(uid),
    ]);
    if (!isScheduleWithinAvailability(proposed, availability)) {
      throw new Error("Your volunteer is not available at that date and time.");
    }
    if (findScheduleConflict(
      proposed,
      assignedRequests.filter(
        (request) => request.assignedVolunteerId === current.assignedVolunteerId,
      ),
    )) {
      throw new Error("Your volunteer already has another activity at that time.");
    }
  }

  const database = requireDb();
  const requestRef = doc(database, "requests", requestId);
  const assignment = assignmentRef(database, requestId);
  const requestUpdate = {
    activityType: values.activityType,
    description: values.description?.trim() || null,
    preferredDate: Timestamp.fromDate(values.preferredDate),
    preferredTime: values.preferredTime,
    durationMinutes: values.durationMinutes ?? null,
    durationLabel: values.durationLabel ?? null,
    location: values.location.trim(),
    latitude: values.latitude ?? null,
    longitude: values.longitude ?? null,
    ...(scheduleChanged && current.assignedVolunteerId
      ? { rescheduledAt: serverTimestamp() }
      : {}),
    updatedAt: serverTimestamp(),
  };

  await runTransaction(database, async (transaction) => {
    const latestSnapshot = await transaction.get(requestRef);
    if (!latestSnapshot.exists()) throw new Error("Request not found.");
    const latest = fromSnapshot(latestSnapshot);
    if (latest.createdBy !== uid) throw new Error("You cannot access this request.");
    if (!["pending", "accepted", "scheduled"].includes(latest.status))
      throw new Error("This request can no longer be edited.");
    if (latest.assignedVolunteerId !== current.assignedVolunteerId)
      throw new Error("The assigned volunteer changed. Please review the request and try again.");

    const assignmentSnapshot = latest.assignedVolunteerId
      ? await transaction.get(assignment)
      : null;
    transaction.update(requestRef, requestUpdate);
    if (scheduleChanged && latest.assignedVolunteerId) {
      if (!assignmentSnapshot?.exists())
        throw new Error("The volunteer assignment could not be found.");
      if (assignmentSnapshot.data()?.volunteerId !== latest.assignedVolunteerId)
        throw new Error("The volunteer assignment has changed. Please try again.");
      transaction.update(assignment, {
        scheduledAt: Timestamp.fromDate(values.preferredDate),
        durationMinutes: values.durationMinutes ?? null,
        generalLocation: values.location.trim(),
        rescheduledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  });

  if (scheduleChanged && current.assignedVolunteerId) {
    await createRescheduleNotifications({
      elderlyId: current.createdBy,
      elderlyName: current.createdByName,
      caregiverId: current.caregiverId,
      requestId,
      activityType: values.activityType,
      preferredDate: values.preferredDate,
      preferredTime: values.preferredTime,
      volunteerId: current.assignedVolunteerId,
      volunteerName: current.volunteerName ?? "your volunteer",
    }).catch((cause) =>
      console.warn("[requests] Reschedule notification could not be stored.", cause),
    );
  }
}

export async function cancelRequest(requestId: string, uid: string) {
  const database = requireDb();
  const current = await getRequestById(requestId, uid);
  if (!["pending", "accepted", "scheduled"].includes(current.status))
    throw new Error("This request can no longer be cancelled.");
  await updateDoc(doc(database, "requests", requestId), {
    status: "cancelled",
    cancelledAt: serverTimestamp(),
    cancelledBy: uid,
    updatedAt: serverTimestamp(),
  });
  // Keep the assignment record in step so a volunteer's dashboard and the
  // admin dashboard (both of which read requestAssignments.status) don't keep
  // showing a cancelled request as an active activity. Swallowed because an
  // assignment written before this doc-id-per-request convention may not
  // exist at this id; the request itself is still the source of truth.
  if (current.assignedVolunteerId) {
    await updateDoc(doc(database, "requestAssignments", requestId), {
      status: "cancelled",
      updatedAt: serverTimestamp(),
    }).catch(() => undefined);
  }
  await createStatusNotification({
    elderlyId: current.createdBy,
    requestId,
    activityType: current.activityType,
    status: "cancelled",
    preferredDate: current.preferredDate,
    preferredTime: current.preferredTime,
    volunteerId: current.assignedVolunteerId,
  }).catch((cause) =>
    console.warn(
      "[requests] Request cancelled but its notification could not be stored.",
      cause,
    ),
  );
}

export async function getOpenRequests(
  max = 20,
): Promise<CompanionshipRequest[]> {
  const database = requireDb();
  const snapshot = await getDocs(
    query(
      collection(database, "requests"),
      where("status", "==", "pending"),
      limit(max),
    ),
  );
  return snapshot.docs
    .map(fromSnapshot)
    .filter((request) => !request.assignedVolunteerId)
    .sort((a, b) => a.preferredDate.getTime() - b.preferredDate.getTime());
}

export interface AcceptingVolunteer {
  uid: string;
  fullName: string;
  verified: boolean;
  photoUrl?: string;
  bio?: string;
  experience?: string;
  rating?: number;
}

export type AcceptanceFailure =
  | "not-a-volunteer"
  | "not-found"
  | "already-accepted"
  | "unavailable"
  | "own-request";

const ACCEPTANCE_MESSAGES: Record<AcceptanceFailure, string> = {
  "not-a-volunteer":
    "Only an approved volunteer account can accept companionship requests.",
  "not-found": "This request no longer exists.",
  "already-accepted":
    "This request has already been accepted by another volunteer.",
  unavailable: "This request is no longer available.",
  "own-request": "You cannot accept a request that you created yourself.",
};

/** Carries a machine-readable reason so screens can react without matching on message text. */
export class RequestAcceptanceError extends Error {
  constructor(public readonly reason: AcceptanceFailure) {
    super(ACCEPTANCE_MESSAGES[reason]);
    this.name = "RequestAcceptanceError";
  }
}

/** The assignment id *is* the request id, so the database can only ever hold one assignment per request. */
function assignmentRef(
  database: ReturnType<typeof requireDb>,
  requestId: string,
) {
  return doc(database, "requestAssignments", requestId);
}

/**
 * Claims a pending request for a volunteer, records the assignment, and tells
 * the elderly user (and their linked caregiver) that support is arranged.
 *
 * The status check and both writes run inside a Firestore transaction. If two
 * volunteers race, the server aborts whichever commit lost, the SDK re-runs
 * this callback, the second read now sees 'accepted', and that volunteer is
 * turned away — so only one assignment can ever exist. The role and status are
 * read from the caller's own profile rather than trusted from the screen.
 */
export async function acceptRequest(
  requestId: string,
  volunteerUid: string,
): Promise<CompanionshipRequest> {
  const database = requireDb();
  const profile = await getUserProfile(volunteerUid).catch(() => null);
  if (
    !profile ||
    profile.role !== "volunteer" ||
    profile.status === "suspended"
  )
    throw new RequestAcceptanceError("not-a-volunteer");
  const publicSnapshot = await getDoc(
    doc(database, "volunteerProfiles", volunteerUid),
  ).catch(() => null);
  const publicData = publicSnapshot?.data();
  const volunteer: AcceptingVolunteer = {
    uid: profile.uid,
    fullName: profile.fullName.trim() || "A SilverLink volunteer",
    verified: profile.status === "active",
    photoUrl: asText(publicData?.photoUrl) ?? profile.photoUrl,
    bio: asText(publicData?.bio),
    experience: asText(publicData?.experience),
    rating:
      typeof publicData?.rating === "number" ? publicData.rating : undefined,
  };

  const requestRef = doc(database, "requests", requestId);
  const assignment = assignmentRef(database, requestId);

  const request = await runTransaction(database, async (transaction) => {
    // Every read must happen before the first write in a Firestore transaction.
    const snapshot = await transaction.get(requestRef);
    if (!snapshot.exists()) throw new RequestAcceptanceError("not-found");
    const current = fromSnapshot(snapshot);
    const existingAssignment = await transaction.get(assignment);

    if (current.createdBy === volunteer.uid)
      throw new RequestAcceptanceError("own-request");
    if (current.assignedVolunteerId || (existingAssignment.exists() && existingAssignment.data()?.status !== "withdrawn"))
      throw new RequestAcceptanceError("already-accepted");
    if (current.status !== "pending")
      throw new RequestAcceptanceError(
        current.status === "accepted" ? "already-accepted" : "unavailable",
      );

    transaction.update(requestRef, {
      status: "accepted",
      assignedVolunteerId: volunteer.uid,
      volunteerName: volunteer.fullName,
      volunteerVerified: volunteer.verified,
      volunteerPhotoUrl: volunteer.photoUrl ?? null,
      volunteerBio: volunteer.bio ?? null,
      volunteerExperience: volunteer.experience ?? null,
      volunteerRating: volunteer.rating ?? null,
      acceptedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    transaction.set(assignment, {
      requestId,
      volunteerId: volunteer.uid,
      activityType: current.activityType,
      scheduledAt: Timestamp.fromDate(current.preferredDate),
      durationMinutes: current.durationMinutes ?? null,
      generalLocation: current.location,
      status: "accepted",
      createdAt: serverTimestamp(),
    });
    return current;
  });

  try {
    await createAcceptanceNotifications({
      elderlyId: request.createdBy,
      elderlyName: request.createdByName,
      caregiverId: request.caregiverId,
      requestId,
      activityType: request.activityType,
      preferredDate: request.preferredDate,
      preferredTime: request.preferredTime,
      volunteerId: volunteer.uid,
      volunteerName: volunteer.fullName,
      volunteerVerified: volunteer.verified,
    });
  } catch (cause) {
    // The acceptance is already committed. Failing here would tell the volunteer
    // their acceptance did not go through, and a retry would then be rejected as
    // a duplicate — so the alert is dropped rather than the assignment.
    console.warn(
      "[requests] Request accepted but the acceptance notification could not be stored.",
      cause,
    );
  }
  return {
    ...request,
    status: "accepted",
    assignedVolunteerId: volunteer.uid,
    volunteerName: volunteer.fullName,
    volunteerVerified: volunteer.verified,
    volunteerPhotoUrl: volunteer.photoUrl,
    volunteerBio: volunteer.bio,
    volunteerExperience: volunteer.experience,
    volunteerRating: volunteer.rating,
  };
}

export class RequestWithdrawalError extends Error {}

export async function withdrawFromActivity(requestId: string, volunteerUid: string): Promise<void> {
  const database = requireDb();
  const profile = await getUserProfile(volunteerUid);
  if (auth?.currentUser?.uid !== volunteerUid || profile?.role !== "volunteer" || profile.status === "suspended")
    throw new RequestWithdrawalError("Only the assigned volunteer can withdraw from this activity.");
  const requestRef = doc(database, "requests", requestId);
  const assignment = assignmentRef(database, requestId);
  const history = doc(collection(database, "requestAssignmentHistory"));
  await runTransaction(database, async (transaction) => {
    const snapshot = await transaction.get(requestRef);
    if (!snapshot.exists()) throw new RequestWithdrawalError("This activity has already been updated.");
    const current = fromSnapshot(snapshot);
    if (current.assignedVolunteerId !== volunteerUid)
      throw new RequestWithdrawalError("This activity has already been updated.");
    if (current.status === "in_progress")
      throw new RequestWithdrawalError("This activity has already started and can no longer be withdrawn.");
    if (!["accepted", "scheduled"].includes(current.status))
      throw new RequestWithdrawalError("This activity can no longer be withdrawn.");
    const previous = await transaction.get(assignment);
    if (previous.exists() && previous.data().volunteerId !== volunteerUid)
      throw new RequestWithdrawalError("This activity has already been updated.");
    transaction.update(requestRef, {
      status: "pending", assignedVolunteerId: null,
      volunteerName: null, volunteerVerified: false, volunteerPhotoUrl: null,
      volunteerBio: null, volunteerExperience: null, volunteerRating: null,
      acceptedAt: null, elderConfirmedAt: null, rescheduledAt: null,
      withdrawnAt: serverTimestamp(), withdrawnBy: volunteerUid, updatedAt: serverTimestamp(),
    });
    const withdrawnAssignment = {
      ...(previous.data() ?? { requestId, volunteerId: volunteerUid }),
      status: "withdrawn", withdrawnAt: serverTimestamp(), updatedAt: serverTimestamp(),
    };
    transaction.set(assignment, withdrawnAssignment);
    transaction.set(history, { ...withdrawnAssignment, requestId, volunteerId: volunteerUid });
    writeWithdrawalNotifications(transaction, {
      requestId, elderlyId: current.createdBy, caregiverId: current.caregiverId,
      volunteerId: volunteerUid, activityType: current.activityType, eventId: history.id,
    });
  });
}

export async function confirmAssignedVolunteer(
  requestId: string,
  elderlyUid: string,
) {
  const database = requireDb();
  const current = await getRequestById(requestId, elderlyUid);
  if (current.status !== "accepted" || !current.assignedVolunteerId)
    throw new Error("This volunteer can no longer be confirmed.");
  await updateDoc(doc(database, "requests", requestId), {
    status: "scheduled",
    elderConfirmedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(database, "requestAssignments", requestId), {
    status: "scheduled",
    elderConfirmedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }).catch((cause) =>
    console.warn(
      "[requests] Request confirmed but assignment status could not be synchronized.",
      cause,
    ),
  );
  await createScheduleConfirmationNotifications({
    elderlyId: current.createdBy,
    elderlyName: current.createdByName,
    caregiverId: current.caregiverId,
    requestId,
    activityType: current.activityType,
    preferredDate: current.preferredDate,
    preferredTime: current.preferredTime,
    volunteerId: current.assignedVolunteerId,
    volunteerName: current.volunteerName ?? "your volunteer",
  }).catch((cause) =>
    console.warn(
      "[requests] Request scheduled but its notification could not be stored.",
      cause,
    ),
  );
}

export async function updateAssignedRequestStatus(
  requestId: string,
  volunteerUid: string,
  nextStatus: "in_progress" | "completed",
) {
  const database = requireDb();
  const current = await getRequestForVolunteer(requestId, volunteerUid);
  const valid =
    (current.status === "scheduled" && nextStatus === "in_progress") ||
    (current.status === "in_progress" && nextStatus === "completed");
  if (!valid) throw new Error("This visit cannot move to that status.");
  const timestampField =
    nextStatus === "in_progress" ? "startedAt" : "completedAt";
  await updateDoc(doc(database, "requests", requestId), {
    status: nextStatus,
    [timestampField]: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(database, "requestAssignments", requestId), {
    status: nextStatus,
    [timestampField]: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }).catch((cause) =>
    console.warn(
      "[requests] Visit updated but assignment status could not be synchronized.",
      cause,
    ),
  );
  await createStatusNotification({
    elderlyId: current.createdBy,
    requestId,
    activityType: current.activityType,
    status: nextStatus,
    preferredDate: current.preferredDate,
    preferredTime: current.preferredTime,
    volunteerId: volunteerUid,
  }).catch((cause) =>
    console.warn(
      "[requests] Visit updated but its notification could not be stored.",
      cause,
    ),
  );
  return { ...current, status: nextStatus };
}

/** Requests this volunteer has claimed — the source for the My Activities screen. */
export async function getVolunteerRequests(
  volunteerUid: string,
): Promise<CompanionshipRequest[]> {
  const snapshot = await getDocs(
    query(
      collection(requireDb(), "requests"),
      where("assignedVolunteerId", "==", volunteerUid),
    ),
  );
  return snapshot.docs
    .map(fromSnapshot)
    .sort((a, b) => a.preferredDate.getTime() - b.preferredDate.getTime());
}

/** A single request, scoped to the volunteer assigned to it — for the volunteer's request-details view. */
export async function getRequestForVolunteer(
  requestId: string,
  volunteerUid: string,
): Promise<CompanionshipRequest> {
  const snapshot = await getDoc(doc(requireDb(), "requests", requestId));
  if (!snapshot.exists()) throw new Error("Request not found.");
  const request = fromSnapshot(snapshot);
  if (request.assignedVolunteerId !== volunteerUid)
    throw new Error("This request is not assigned to you.");
  return request;
}

/**
 * A single request for the volunteer's details view, covering both stages of
 * that screen: still-open (pending, unassigned — browsing before acceptance)
 * and already assigned to this volunteer (tracking an accepted visit). A
 * request assigned to someone else, or in any other state, is not theirs to
 * view in detail.
 */
export async function getRequestForVolunteerView(
  requestId: string,
  volunteerUid: string,
): Promise<CompanionshipRequest> {
  const snapshot = await getDoc(doc(requireDb(), "requests", requestId));
  if (!snapshot.exists()) throw new Error("Request not found.");
  const request = fromSnapshot(snapshot);
  const isOpen = request.status === "pending" && !request.assignedVolunteerId;
  const isMine = request.assignedVolunteerId === volunteerUid;
  if (!isOpen && !isMine)
    throw new Error("This request is no longer available.");
  return request;
}

/**
 * Get all requests for an elderly user, accessible by a caregiver with accepted link.
 * For caregiver read-only access to linked elderly user's requests.
 */
export async function getRequestsForLinkedElderlyUser(
  elderlyUserId: string,
): Promise<CompanionshipRequest[]> {
  const database = requireDb();
  const snapshot = await getDocs(
    query(
      collection(database, "requests"),
      where("createdBy", "==", elderlyUserId),
    ),
  );
  return snapshot.docs
    .map(fromSnapshot)
    .sort(compareRequestsNewestFirst);
}
