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
  adminNote: string;
}

/** An option the reporter can pick as the subject of the report. */
export interface ReportSubjectOption {
  type: Exclude<ReportSubjectType, 'none'>;
  id: string;
  label: string;
  detail: string;
}
