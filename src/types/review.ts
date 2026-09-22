export interface ActivityReview {
  id: string;
  requestId: string;
  elderlyUserId: string;
  volunteerId: string;
  rating: number;
  comment?: string;
  createdAt?: Date;
}

export interface ActivityReviewValues {
  rating: number;
  comment?: string;
}
