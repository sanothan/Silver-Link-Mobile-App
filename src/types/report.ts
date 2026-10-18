export type ReportCategory =
  | 'unsafe_behaviour'
  | 'harassment'
  | 'scam_or_fraud'
  | 'inappropriate_content'
  | 'no_show'
  | 'other';

export type ReportStatus = 'open' | 'under_review' | 'resolved' | 'dismissed';

export type ReportSubjectType = 'user' | 'activity' | 'none';

export const REPORT_CATEGORIES: { value: ReportCategory; label: string; urgent: boolean }[] = [
  { value: 'unsafe_behaviour', label: 'Unsafe behaviour', urgent: true },
  { value: 'harassment', label: 'Harassment or abuse', urgent: true },
  { value: 'scam_or_fraud', label: 'Scam or financial pressure', urgent: true },
  { value: 'inappropriate_content', label: 'Inappropriate content', urgent: false },
  { value: 'no_show', label: 'Missed or abandoned activity', urgent: false },
  { value: 'other', label: 'Something else', urgent: false },
];

export const REPORT_CATEGORY_LABEL: Record<ReportCategory, string> = REPORT_CATEGORIES.reduce(
  (labels, category) => ({ ...labels, [category.value]: category.label }),
  {} as Record<ReportCategory, string>,
);

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  open: 'Open',
  under_review: 'Under review',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};

/** The statuses an administrator can move a report to, in the order they appear on screen. */
export const REPORT_TRIAGE_STATUSES: { value: ReportStatus; label: string; description: string }[] = [
  { value: 'open', label: 'Open', description: 'Waiting for an administrator to pick it up.' },
  { value: 'under_review', label: 'Under review', description: 'Being investigated right now.' },
  { value: 'resolved', label: 'Resolved', description: 'Action was taken and the concern is closed.' },
  { value: 'dismissed', label: 'Dismissed', description: 'No action needed after review.' },
];

/** Statuses that close a report, and so may only be set alongside a resolution note. */
export const CLOSING_REPORT_STATUSES: ReportStatus[] = ['resolved', 'dismissed'];

/** A user or activity the report is about. Reports may also stand alone. */
export interface ReportSubject {
  type: ReportSubjectType;
  /** Firestore id of the reported user or activity; empty when type is 'none'. */
  id: string;
  /** Human readable label captured at submission time so admins keep context. */
  label: string;
}

/** What the submission form collects, before it reaches Firestore. */
export interface ReportDraft {
  category: ReportCategory | null;
  subject: ReportSubject;
  description: string;
}

/** A stored report. `reporterId`/`reporterRole` are only ever populated for administrators. */
export interface ReportRecord {
  id: string;
  category: ReportCategory;
  urgent: boolean;
  subject: ReportSubject;
  description: string;
  status: ReportStatus;
  reporterId: string | null;
  reporterRole: string | null;
  createdAt?: Date;
  resolvedAt?: Date;
  /** The most recent resolution note, copied out of `statusHistory` for quick display. */
  adminNote: string;
  /** Every status change in the order it happened, oldest first. */
  statusHistory: ReportStatusChange[];
  /** Firestore id of the administrator who last triaged the report. */
  lastUpdatedBy: string | null;
  updatedAt?: Date;
}

/** One recorded status change, stored so the triage of a report can be audited later. */
export interface ReportStatusChange {
  /** The status the report moved to. */
  status: ReportStatus;
  /** The status it moved from, so each entry reads on its own. */
  previousStatus: ReportStatus;
  /** The resolution note the administrator recorded with this change; empty when none. */
  note: string;
  /** Firestore id of the administrator who made the change. */
  changedBy: string;
  changedAt?: Date;
}

/** An option the reporter can pick as the subject of the report. */
export interface ReportSubjectOption {
  type: Exclude<ReportSubjectType, 'none'>;
  id: string;
  label: string;
  detail: string;
}
