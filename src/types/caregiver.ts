import type { Timestamp } from "firebase/firestore";

export type CaregiverLinkStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "cancelled";

export interface CaregiverLink {
  id: string;
  caregiverId: string;
  elderlyUserId: string;
  status: CaregiverLinkStatus;
  requestedBy: "caregiver";
  caregiverName?: string;
  caregiverPhotoUrl?: string;
  relationship?: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  acceptedAt?: Timestamp | Date;
  rejectedAt?: Timestamp | Date;
  cancelledAt?: Timestamp | Date;
}

export interface ElderlyCaregiverLinkDisplay {
  id: string;
  caregiverId: string;
  elderlyUserId: string;
  caregiverName: string;
  caregiverPhotoUrl?: string;
  relationship?: string;
  status: CaregiverLinkStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CaregiverLinkDisplay extends Omit<
  CaregiverLink,
  "createdAt" | "updatedAt" | "acceptedAt" | "rejectedAt" | "cancelledAt"
> {
  elderlyName: string;
  elderlyEmail: string;
  elderlyPhotoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  acceptedAt?: Date;
  rejectedAt?: Date;
  cancelledAt?: Date;
}
