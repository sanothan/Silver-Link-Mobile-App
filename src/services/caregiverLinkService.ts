import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    runTransaction,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
    type Timestamp,
} from "firebase/firestore";
import type {
  CaregiverLink,
  CaregiverLinkDisplay,
  ElderlyCaregiverLinkDisplay,
} from "../types/caregiver";
import { db } from "./firebaseConfig";
import { getUserProfile } from "./userService";
import {
  createCaregiverLinkDecisionNotification,
  createCaregiverLinkRequestNotification,
} from "./notificationService";

function requireDb() {
  if (!db) throw new Error("Firebase is not configured.");
  return db;
}

function asText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asDate(value: unknown): Date | undefined {
  return value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
    ? value.toDate()
    : value instanceof Date
      ? value
      : undefined;
}

function fromFirestore(id: string, data: any): CaregiverLink {
  return {
    id,
    caregiverId: asText(data.caregiverId) ?? "",
    elderlyUserId: asText(data.elderlyUserId) ?? "",
    status: ["pending", "accepted", "rejected", "cancelled"].includes(
      data.status,
    )
      ? data.status
      : "pending",
    requestedBy: "caregiver",
    caregiverName: asText(data.caregiverName),
    caregiverPhotoUrl: asText(data.caregiverPhotoUrl),
    relationship: asText(data.relationship),
    createdAt: asDate(data.createdAt) ?? new Date(),
    updatedAt: asDate(data.updatedAt) ?? new Date(),
    ...(data.acceptedAt && { acceptedAt: asDate(data.acceptedAt) }),
    ...(data.rejectedAt && { rejectedAt: asDate(data.rejectedAt) }),
    ...(data.cancelledAt && { cancelledAt: asDate(data.cancelledAt) }),
  };
}

/**
 * Find an elderly user by email address.
 * Only returns the user if their role is 'elderly'.
 */
export async function findElderlyUserByEmail(email: string) {
  const dbRef = requireDb();
  const normalizedEmail = email.trim().toLowerCase();

  const q = query(
    collection(dbRef, "elderlyDirectory"),
    where("email", "==", normalizedEmail),
    where("role", "==", "elderly"),
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }

  const profile = snapshot.docs[0].data();

  return {
    uid: asText(profile.uid) ?? snapshot.docs[0].id,
    fullName: asText(profile.fullName) ?? "SilverLink member",
    email: asText(profile.email) ?? normalizedEmail,
    photoUrl: asText(profile.photoUrl),
  };
}

/**
 * Check if a caregiver already has a pending or accepted link with an elderly user.
 */
export async function checkExistingLink(
  caregiverId: string,
  elderlyUserId: string,
): Promise<{ exists: boolean; status?: string }> {
  const dbRef = requireDb();

  const q = query(
    collection(dbRef, "caregiverLinks"),
    where("caregiverId", "==", caregiverId),
    where("elderlyUserId", "==", elderlyUserId),
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return { exists: false };
  }

  const active = snapshot.docs
    .map((item) => item.data().status as string)
    .find((status) => status === "pending" || status === "accepted");
  if (active) return { exists: true, status: active };

  return { exists: false };
}

/**
 * Send a caregiver link request to an elderly user.
 * The request starts with status = 'pending'.
 */
export async function sendCaregiverLinkRequest(
  caregiverId: string,
  elderlyUserId: string,
): Promise<CaregiverLink> {
  const dbRef = requireDb();

  // Prevent self-linking
  if (caregiverId === elderlyUserId) {
    throw new Error(
      "You cannot send a connection request to your own account.",
    );
  }

  // Check for duplicate pending or accepted requests
  const existing = await checkExistingLink(caregiverId, elderlyUserId);
  if (existing.exists) {
    if (existing.status === "pending") {
      throw new Error(
        "A connection request has already been sent to this user.",
      );
    }
    if (existing.status === "accepted") {
      throw new Error("You are already connected with this elderly user.");
    }
  }

  // Verify elderly user exists and has the correct role
  const elderlySnapshot = await getDoc(doc(dbRef, "elderlyDirectory", elderlyUserId));
  if (!elderlySnapshot.exists() || elderlySnapshot.data().role !== "elderly")
    throw new Error("We couldn't find the elderly user. Please try again.");

  const caregiverProfile = await getUserProfile(caregiverId);
  if (caregiverProfile.role !== "caregiver") {
    throw new Error("Only a caregiver account can send a connection request.");
  }

  // Create the link request
  const linkId = doc(collection(dbRef, "caregiverLinks")).id;
  const now = serverTimestamp() as Timestamp;

  const linkData: Omit<CaregiverLink, "id"> = {
    caregiverId,
    elderlyUserId,
    status: "pending",
    requestedBy: "caregiver",
    caregiverName: caregiverProfile.fullName,
    ...(caregiverProfile.photoUrl && {
      caregiverPhotoUrl: caregiverProfile.photoUrl,
    }),
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(dbRef, "caregiverLinks", linkId), linkData);

  await createCaregiverLinkRequestNotification({
    linkId,
    caregiverId,
    caregiverName: caregiverProfile.fullName,
    elderlyUserId,
  }).catch((error) =>
    console.warn("Caregiver link created but its notification could not be stored.", error),
  );

  return {
    id: linkId,
    ...linkData,
  };
}

export async function getCaregiverLinksForElderly(
  elderlyUserId: string,
): Promise<ElderlyCaregiverLinkDisplay[]> {
  const snapshot = await getDocs(
    query(
      collection(requireDb(), "caregiverLinks"),
      where("elderlyUserId", "==", elderlyUserId),
    ),
  );

  return snapshot.docs
    .map((item) => fromFirestore(item.id, item.data()))
    .map((link) => ({
      id: link.id,
      caregiverId: link.caregiverId,
      elderlyUserId: link.elderlyUserId,
      caregiverName: link.caregiverName || "SilverLink caregiver",
      caregiverPhotoUrl: link.caregiverPhotoUrl,
      relationship: link.relationship,
      status: link.status,
      createdAt: asDate(link.createdAt) ?? new Date(),
      updatedAt: asDate(link.updatedAt) ?? new Date(),
    }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

async function decideCaregiverLink(
  linkId: string,
  elderlyUserId: string,
  decision: "accepted" | "rejected",
): Promise<CaregiverLink> {
  const database = requireDb();
  const linkRef = doc(database, "caregiverLinks", linkId);
  const elderlyRef = doc(database, "users", elderlyUserId);

  const result = await runTransaction(database, async (transaction) => {
    const [linkSnapshot, elderlySnapshot] = await Promise.all([
      transaction.get(linkRef),
      transaction.get(elderlyRef),
    ]);
    if (!linkSnapshot.exists()) throw new Error("This connection request does not exist.");
    if (!elderlySnapshot.exists()) throw new Error("Your SilverLink profile could not be found.");

    const link = fromFirestore(linkSnapshot.id, linkSnapshot.data());
    if (link.elderlyUserId !== elderlyUserId)
      throw new Error("You cannot update this connection request.");
    if (link.status !== "pending")
      throw new Error("This connection request has already been updated.");
    const elderlyData = elderlySnapshot.data();
    if (
      decision === "accepted" &&
      asText(elderlyData.caregiverId) &&
      elderlyData.caregiverId !== link.caregiverId
    ) {
      throw new Error("A caregiver is already connected to this account.");
    }

    const timestampField = decision === "accepted" ? "acceptedAt" : "rejectedAt";
    transaction.update(linkRef, {
      status: decision,
      [timestampField]: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    if (decision === "accepted") {
      transaction.update(elderlyRef, {
        caregiverId: link.caregiverId,
        caregiverLinkId: link.id,
        updatedAt: serverTimestamp(),
      });
    }

    return {
      link,
      elderlyName: asText(elderlyData.fullName) ?? "Your family member",
    };
  });

  await createCaregiverLinkDecisionNotification({
    linkId,
    caregiverId: result.link.caregiverId,
    elderlyUserId,
    elderlyName: result.elderlyName,
    decision,
  }).catch((error) =>
    console.warn("Caregiver link updated but its notification could not be stored.", error),
  );
  return { ...result.link, status: decision, updatedAt: new Date() };
}

export function acceptCaregiverLink(linkId: string, elderlyUserId: string) {
  return decideCaregiverLink(linkId, elderlyUserId, "accepted");
}

export function rejectCaregiverLink(linkId: string, elderlyUserId: string) {
  return decideCaregiverLink(linkId, elderlyUserId, "rejected");
}

/**
 * Get all caregiver link requests for a given caregiver.
 */
export async function getCaregiverLinks(
  caregiverId: string,
): Promise<CaregiverLinkDisplay[]> {
  const dbRef = requireDb();

  const q = query(
    collection(dbRef, "caregiverLinks"),
    where("caregiverId", "==", caregiverId),
  );

  const snapshot = await getDocs(q);
  const links: CaregiverLinkDisplay[] = [];

  for (const docSnapshot of snapshot.docs) {
    const link = fromFirestore(docSnapshot.id, docSnapshot.data());
    if (link.status !== "pending" && link.status !== "accepted") continue;

    try {
      const elderlyProfile = await getUserProfile(link.elderlyUserId);
      links.push({
        id: link.id,
        caregiverId: link.caregiverId,
        elderlyUserId: link.elderlyUserId,
        elderlyName: elderlyProfile.fullName,
        elderlyEmail: elderlyProfile.email,
        elderlyPhotoUrl: elderlyProfile.photoUrl,
        status: link.status,
        requestedBy: "caregiver",
        createdAt: asDate(link.createdAt) || new Date(),
        updatedAt: asDate(link.updatedAt) || new Date(),
        ...(link.acceptedAt && { acceptedAt: asDate(link.acceptedAt) }),
        ...(link.rejectedAt && { rejectedAt: asDate(link.rejectedAt) }),
        ...(link.cancelledAt && { cancelledAt: asDate(link.cancelledAt) }),
      });
    } catch (err) {
      console.warn(
        `Could not load profile for elderly user ${link.elderlyUserId}:`,
        err,
      );
    }
  }

  return links;
}

/**
 * Get only pending caregiver link requests.
 */
export async function getPendingCaregiverLinks(
  caregiverId: string,
): Promise<CaregiverLinkDisplay[]> {
  const allLinks = await getCaregiverLinks(caregiverId);
  return allLinks.filter((link) => link.status === "pending");
}

/**
 * Get only accepted caregiver link requests (i.e., linked elderly users).
 */
export async function getAcceptedElderlyLinks(
  caregiverId: string,
): Promise<CaregiverLinkDisplay[]> {
  const allLinks = await getCaregiverLinks(caregiverId);
  return allLinks.filter((link) => link.status === "accepted");
}

/**
 * Cancel a pending caregiver link request.
 * Only the caregiver who created it can cancel it.
 */
export async function cancelCaregiverLinkRequest(
  linkId: string,
  caregiverId: string,
): Promise<void> {
  const dbRef = requireDb();

  const linkRef = doc(dbRef, "caregiverLinks", linkId);
  const linkSnapshot = await getDoc(linkRef);

  if (!linkSnapshot.exists()) {
    throw new Error("This connection request does not exist.");
  }

  const link = linkSnapshot.data();

  if (link.caregiverId !== caregiverId) {
    throw new Error("You can only cancel your own connection requests.");
  }

  if (link.status !== "pending") {
    throw new Error("Only pending connection requests can be cancelled.");
  }

  await updateDoc(linkRef, {
    status: "cancelled",
    cancelledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Check if a caregiver has an accepted link with an elderly user.
 * Used to verify access before showing requests or other sensitive data.
 */
export async function hasAcceptedCaregiverLink(
  caregiverId: string,
  elderlyUserId: string,
): Promise<boolean> {
  const dbRef = requireDb();

  const linksSnapshot = await getDocs(
    query(
      collection(dbRef, "caregiverLinks"),
      where("caregiverId", "==", caregiverId),
      where("elderlyUserId", "==", elderlyUserId),
      where("status", "==", "accepted"),
    ),
  );

  return linksSnapshot.size > 0;
}
