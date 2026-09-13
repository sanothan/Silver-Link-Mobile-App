import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  type DocumentData,
} from "firebase/firestore";
import type { ActivityReview, ActivityReviewValues } from "../types/review";
import { db } from "./firebaseConfig";

function requireDb() {
  if (!db) throw new Error("Firebase is not configured.");
  return db;
}

function toReview(id: string, data: DocumentData): ActivityReview {
  const createdAt = data.createdAt?.toDate?.();
  return {
    id,
    requestId: data.requestId,
    elderlyUserId: data.elderlyUserId,
    volunteerId: data.volunteerId,
    rating: data.rating,
    comment: typeof data.comment === "string" ? data.comment : undefined,
    createdAt: createdAt instanceof Date ? createdAt : undefined,
  };
}

export async function getActivityReview(
  requestId: string,
  elderlyUserId: string,
): Promise<ActivityReview | null> {
  const reviewId = `${requestId}_${elderlyUserId}`;
  const snapshot = await getDoc(doc(requireDb(), "activityReviews", reviewId));
  return snapshot.exists() ? toReview(snapshot.id, snapshot.data()) : null;
}

export async function submitActivityReview(
  requestId: string,
  elderlyUserId: string,
  values: ActivityReviewValues,
): Promise<void> {
  if (!Number.isInteger(values.rating) || values.rating < 1 || values.rating > 5)
    throw new Error("Please choose a rating from 1 to 5 stars.");
  if ((values.comment?.trim().length ?? 0) > 500)
    throw new Error("Please keep your comment under 500 characters.");

  const database = requireDb();
  const requestRef = doc(database, "requests", requestId);
  const reviewRef = doc(database, "activityReviews", `${requestId}_${elderlyUserId}`);
  await runTransaction(database, async (transaction) => {
    const requestSnapshot = await transaction.get(requestRef);
    const reviewSnapshot = await transaction.get(reviewRef);
    if (!requestSnapshot.exists()) throw new Error("Activity not found.");
    const request = requestSnapshot.data();
    if (request.createdBy !== elderlyUserId)
      throw new Error("You cannot review this activity.");
    if (request.status !== "completed")
      throw new Error("Feedback is available after the activity is completed.");
    if (!request.assignedVolunteerId)
      throw new Error("This activity does not have an assigned volunteer.");
    if (reviewSnapshot.exists())
      throw new Error("You have already reviewed this activity.");
    transaction.set(reviewRef, {
      requestId,
      elderlyUserId,
      volunteerId: request.assignedVolunteerId,
      rating: values.rating,
      comment: values.comment?.trim() || null,
      createdAt: serverTimestamp(),
    });
  });
}
