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
  type Transaction,
} from "firebase/firestore";
import { db } from "./firebaseConfig";
import {
  ACCEPTANCE_NOTIFICATION_TITLE,
  ACCEPTANCE_NOTIFICATION_TITLE_CAREGIVER,
  ACCEPTANCE_NOTIFICATION_TITLE_VOLUNTEER,
  RESCHEDULE_NOTIFICATION_TITLE,
  SCHEDULE_CONFIRMATION_TITLE,
  VOLUNTEER_VERIFICATION_APPROVED_TITLE,
  VOLUNTEER_VERIFICATION_REJECTED_TITLE,
  buildAcceptanceMessage,
  buildRescheduleMessage,
  buildScheduleConfirmationMessage,
  buildStatusNotificationContent,
  buildVolunteerVerificationMessage,
  notificationTypeForStatus,
  type AcceptanceNotificationContext,
  type AppNotification,
  type CaregiverLinkDecisionNotificationContext,
  type CaregiverLinkRequestNotificationContext,
  type NotificationAudience,
  type NotificationType,
  type ScheduleConfirmationContext,
  type StatusNotificationContext,
  type VolunteerVerificationNotificationContext,
  type ChatMessageNotificationContext,
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
  "volunteer_withdrawn",
  "request_accepted",
  "request_scheduled",
  "request_rescheduled",
  "request_started",
  "request_completed",
  "request_cancelled",
  "caregiver_link_request",
  "caregiver_link_accepted",
  "caregiver_link_rejected",
  "chat_message",
  "volunteer_verification_approved",
  "volunteer_verification_rejected",
];

export function writeWithdrawalNotifications(transaction: Transaction, context: {
  requestId: string; elderlyId: string; caregiverId?: string;
  volunteerId: string; activityType: string; eventId: string;
}) {
  const recipients = [{ userId: context.elderlyId, audience: "elderly" }];
  if (context.caregiverId) recipients.push({ userId: context.caregiverId, audience: "caregiver" });
  for (const recipient of recipients) {
    transaction.set(doc(requireDb(), "notifications", `${context.eventId}_${recipient.userId}`), {
      ...recipient, type: "volunteer_withdrawn", requestId: context.requestId,
      volunteerId: context.volunteerId, read: false, createdAt: serverTimestamp(),
      title: recipient.audience === "elderly" ? "Volunteer Withdrew" : "Volunteer Withdrawal",
      message: recipient.audience === "elderly"
        ? `The volunteer for your ${context.activityType} request is no longer available. We are looking for another volunteer.`
        : "The volunteer assigned to your linked elderly user's activity has withdrawn.",
    });
  }
}

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
    chatId: asText(data.chatId),
    senderId: asText(data.senderId),
    linkId: asText(data.linkId),
    volunteerId: asText(data.volunteerId),
    volunteerName: asText(data.volunteerName),
    volunteerVerified: data.volunteerVerified === true,
    read: data.read === true,
    createdAt: asDate(data.createdAt),
  };
}

function caregiverLinkNotificationId(linkId: string, type: NotificationType, userId: string) {
  return `${linkId}_${type}_${userId}`;
}

export async function createCaregiverLinkRequestNotification(
  context: CaregiverLinkRequestNotificationContext,
) {
  const database = requireDb();
  const type = "caregiver_link_request" as const;
  await setDoc(
    doc(database, "notifications", caregiverLinkNotificationId(context.linkId, type, context.elderlyUserId)),
    {
      userId: context.elderlyUserId,
      audience: "elderly",
      type,
      title: "Caregiver Connection Request",
      message: `${context.caregiverName} would like to connect with you as a caregiver.`,
      linkId: context.linkId,
      caregiverId: context.caregiverId,
      read: false,
      createdAt: serverTimestamp(),
    },
  );
}

export async function createCaregiverLinkDecisionNotification(
  context: CaregiverLinkDecisionNotificationContext,
) {
  const database = requireDb();
  const accepted = context.decision === "accepted";
  const type = accepted ? "caregiver_link_accepted" : "caregiver_link_rejected";
  await setDoc(
    doc(database, "notifications", caregiverLinkNotificationId(context.linkId, type, context.caregiverId)),
    {
      userId: context.caregiverId,
      audience: "caregiver",
      type,
      title: accepted ? "Connection Accepted" : "Connection Request Declined",
      message: accepted
        ? `${context.elderlyName} accepted your caregiver connection request.`
        : "Your caregiver connection request was declined.",
      linkId: context.linkId,
      elderlyUserId: context.elderlyUserId,
      read: false,
      createdAt: serverTimestamp(),
    },
  );
}

/**
 * Tells a volunteer how their verification was decided. The id is keyed on the
 * volunteer and the decision, so replaying a decision updates the same alert
 * instead of stacking duplicates, while a later reversal arrives as its own.
 */
export async function createVolunteerVerificationNotification(
  context: VolunteerVerificationNotificationContext,
) {
  const database = requireDb();
  const approved = context.decision === "approved";
  const type = approved
    ? ("volunteer_verification_approved" as const)
    : ("volunteer_verification_rejected" as const);
  await setDoc(
    doc(database, "notifications", `${context.volunteerId}_${type}`),
    {
      userId: context.volunteerId,
      audience: "volunteer",
      type,
      title: approved
        ? VOLUNTEER_VERIFICATION_APPROVED_TITLE
        : VOLUNTEER_VERIFICATION_REJECTED_TITLE,
      message: buildVolunteerVerificationMessage(context),
      volunteerId: context.volunteerId,
      volunteerName: context.volunteerName ?? null,
      volunteerVerified: approved,
      read: false,
      createdAt: serverTimestamp(),
    },
  );
}

export async function createChatMessageNotification(
  context: ChatMessageNotificationContext,
) {
  const database = requireDb();
  const sender = context.senderRole === "caregiver" ? "Caregiver" : "Volunteer";
  await setDoc(
    doc(
      database,
      "notifications",
      `${context.requestId}_chat_message_${context.recipientId}_${context.messageId}`,
    ),
    {
      userId: context.recipientId,
      audience: context.senderRole === "caregiver" ? "volunteer" : "caregiver",
      type: "chat_message",
      title: `New Message From ${sender}`,
      message:
        context.senderRole === "caregiver"
          ? `You have a new message about your ${context.activityType} activity.`
          : "You have a new message from the volunteer about your linked elderly user's activity.",
      requestId: context.requestId,
      chatId: context.requestId,
      senderId: context.senderId,
      read: false,
      createdAt: serverTimestamp(),
    },
  );
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

export async function createRescheduleNotifications(
  context: ScheduleConfirmationContext,
) {
  const database = requireDb();
  const batch = writeBatch(database);
  const type = "request_rescheduled" as const;
  const recipients: {
    userId: string;
    audience: NotificationAudience;
  }[] = [
    { userId: context.elderlyId, audience: "elderly" },
    { userId: context.volunteerId, audience: "volunteer" },
  ];
  if (context.caregiverId && context.caregiverId !== context.elderlyId) {
    recipients.push({
      userId: context.caregiverId,
      audience: "caregiver",
    });
  }

  recipients.forEach(({ userId, audience }) => {
    batch.set(
      doc(
        database,
        "notifications",
        notificationId(context.requestId, type, audience, userId),
      ),
      {
        userId,
        audience,
        type,
        title: RESCHEDULE_NOTIFICATION_TITLE,
        message: buildRescheduleMessage(context, audience),
        requestId: context.requestId,
        volunteerId: context.volunteerId,
        volunteerName: context.volunteerName,
        read: false,
        createdAt: serverTimestamp(),
      },
    );
  });
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
