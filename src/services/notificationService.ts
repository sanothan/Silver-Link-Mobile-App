import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebaseConfig";
import {
  ACCEPTANCE_NOTIFICATION_TITLE,
  ACCEPTANCE_NOTIFICATION_TITLE_CAREGIVER,
  ACCEPTANCE_NOTIFICATION_TITLE_VOLUNTEER,
  SCHEDULE_CONFIRMATION_TITLE,
  buildAcceptanceMessage,
  buildScheduleConfirmationMessage,
  buildStatusNotificationContent,
  notificationTypeForStatus,
  type AcceptanceNotificationContext,
  type AppNotification,
  type NotificationAudience,
  type NotificationType,
  type ScheduleConfirmationContext,
  type StatusNotificationContext,
} from "../types/notification";

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
function asText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
const TYPES: NotificationType[] = [
  "request_accepted",
  "request_scheduled",
  "request_started",
  "request_completed",
  "request_cancelled",
];

function fromSnapshot(snapshot: {
  id: string;
  data(): DocumentData | undefined;
}): AppNotification {
  const data = snapshot.data() ?? {};
  const type = TYPES.includes(data.type) ? data.type : "request_accepted";
  return {
    id: snapshot.id,
    userId: asText(data.userId) ?? "",
    audience:
      data.audience === "caregiver"
        ? "caregiver"
        : data.audience === "volunteer"
          ? "volunteer"
          : "elderly",
    type,
    title: asText(data.title) ?? ACCEPTANCE_NOTIFICATION_TITLE,
    message: asText(data.message) ?? "",
    requestId: asText(data.requestId),
    volunteerId: asText(data.volunteerId),
    volunteerName: asText(data.volunteerName),
    volunteerVerified: data.volunteerVerified === true,
    read: data.read === true,
    createdAt: asDate(data.createdAt),
  };
}

function notificationId(
  requestId: string,
  type: NotificationType,
  audience: NotificationAudience,
  userId: string,
) {
  return `${requestId}_${type}_${audience}_${userId}`;
}
function acceptancePayload(
  context: AcceptanceNotificationContext,
  userId: string,
  audience: NotificationAudience,
) {
  return {
    userId,
    audience,
    type: "request_accepted" as const,
    title:
      audience === "caregiver"
        ? ACCEPTANCE_NOTIFICATION_TITLE_CAREGIVER
        : audience === "volunteer"
          ? ACCEPTANCE_NOTIFICATION_TITLE_VOLUNTEER
          : ACCEPTANCE_NOTIFICATION_TITLE,
    message: buildAcceptanceMessage(context, audience),
    requestId: context.requestId,
    volunteerId: context.volunteerId,
    volunteerName: context.volunteerName,
    volunteerVerified: context.volunteerVerified,
    read: false,
    createdAt: serverTimestamp(),
  };
}

/** Deterministic IDs make retries idempotent for each request status transition. */
export async function createAcceptanceNotifications(
  context: AcceptanceNotificationContext,
) {
  const database = requireDb();
  const batch = writeBatch(database);
  const type = "request_accepted" as const;
  batch.set(
    doc(
      database,
      "notifications",
      notificationId(context.requestId, type, "elderly", context.elderlyId),
    ),
    acceptancePayload(context, context.elderlyId, "elderly"),
  );
  batch.set(
    doc(
      database,
      "notifications",
      notificationId(context.requestId, type, "volunteer", context.volunteerId),
    ),
    acceptancePayload(context, context.volunteerId, "volunteer"),
  );
  if (context.caregiverId && context.caregiverId !== context.elderlyId)
    batch.set(
      doc(
        database,
        "notifications",
        notificationId(
          context.requestId,
          type,
          "caregiver",
          context.caregiverId,
        ),
      ),
      acceptancePayload(context, context.caregiverId, "caregiver"),
    );
  await batch.commit();
}

function scheduleConfirmationPayload(
  context: ScheduleConfirmationContext,
  userId: string,
  audience: NotificationAudience,
) {
  return {
    userId,
    audience,
    type: "request_scheduled" as const,
    title: SCHEDULE_CONFIRMATION_TITLE,
    message: buildScheduleConfirmationMessage(context, audience),
    requestId: context.requestId,
    volunteerId: context.volunteerId,
    volunteerName: context.volunteerName,
    read: false,
    createdAt: serverTimestamp(),
  };
}

/**
 * Fires once the elderly user confirms the volunteer's schedule. Notifies the
 * elderly user, the volunteer, and the linked caregiver (if any) that the
 * date and time are locked in — deterministic IDs keep retries idempotent.
 */
export async function createScheduleConfirmationNotifications(
  context: ScheduleConfirmationContext,
) {
  const database = requireDb();
  const batch = writeBatch(database);
  const type = "request_scheduled" as const;
  batch.set(
    doc(
      database,
      "notifications",
      notificationId(context.requestId, type, "elderly", context.elderlyId),
    ),
    scheduleConfirmationPayload(context, context.elderlyId, "elderly"),
  );
  batch.set(
    doc(
      database,
      "notifications",
      notificationId(context.requestId, type, "volunteer", context.volunteerId),
    ),
    scheduleConfirmationPayload(context, context.volunteerId, "volunteer"),
  );
  if (context.caregiverId && context.caregiverId !== context.elderlyId)
    batch.set(
      doc(
        database,
        "notifications",
        notificationId(
          context.requestId,
          type,
          "caregiver",
          context.caregiverId,
        ),
      ),
      scheduleConfirmationPayload(context, context.caregiverId, "caregiver"),
    );
  await batch.commit();
}

export async function createStatusNotification(
  context: StatusNotificationContext,
) {
  const database = requireDb();
  const type = notificationTypeForStatus(context.status);
  const content = buildStatusNotificationContent(context);
  await setDoc(
    doc(
      database,
      "notifications",
      notificationId(context.requestId, type, "elderly", context.elderlyId),
    ),
    {
      userId: context.elderlyId,
      audience: "elderly",
      type,
      ...content,
      requestId: context.requestId,
      volunteerId: context.volunteerId ?? null,
      read: false,
      createdAt: serverTimestamp(),
    },
  );
}

export async function getNotifications(
  uid: string,
  max = 30,
): Promise<AppNotification[]> {
  const snapshot = await getDocs(
    query(collection(requireDb(), "notifications"), where("userId", "==", uid)),
  );
  return snapshot.docs
    .map(fromSnapshot)
    .sort(
      (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
    )
    .slice(0, max);
}
export async function getUnreadNotificationCount(uid: string): Promise<number> {
  const snapshot = await getDocs(
    query(
      collection(requireDb(), "notifications"),
      where("userId", "==", uid),
      where("read", "==", false),
    ),
  );
  return snapshot.size;
}
export function subscribeToNotifications(
  uid: string,
  onChange: (items: AppNotification[]) => void,
  onError: () => void = () => undefined,
): Unsubscribe {
  const notifications = query(
    collection(requireDb(), "notifications"),
    where("userId", "==", uid),
  );
  return onSnapshot(
    notifications,
    (snapshot) =>
      onChange(
        snapshot.docs
          .map(fromSnapshot)
          .sort(
            (a, b) =>
              (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
          ),
      ),
    onError,
  );
}
export async function markNotificationRead(notificationId: string) {
  await updateDoc(doc(requireDb(), "notifications", notificationId), {
    read: true,
    readAt: serverTimestamp(),
  });
}
export async function markAllNotificationsRead(uid: string) {
  const database = requireDb();
  const snapshot = await getDocs(
    query(
      collection(database, "notifications"),
      where("userId", "==", uid),
      where("read", "==", false),
    ),
  );
  if (snapshot.empty) return;
  const batch = writeBatch(database);
  snapshot.docs.forEach((item) =>
    batch.update(item.ref, { read: true, readAt: serverTimestamp() }),
  );
  await batch.commit();
}
