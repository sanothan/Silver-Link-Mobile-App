import { CLOSING_REPORT_STATUSES, REPORT_TRIAGE_STATUSES } from '../types/report';
import type { ReportRecord, ReportStatus, ReportStatusChange } from '../types/report';

export const RESOLUTION_NOTE_MIN_LENGTH = 10;
export const RESOLUTION_NOTE_MAX_LENGTH = 1000;

export type TriageField = 'status' | 'note';

export interface TriageDecision {
  status: ReportStatus;
  note: string;
}

export interface TriageValidationResult {
  valid: boolean;
  errors: Partial<Record<TriageField, string>>;
}

export function isReportStatus(value: unknown): value is ReportStatus {
  return REPORT_TRIAGE_STATUSES.some((entry) => entry.value === value);
}

/** Resolving or dismissing a report closes it, which is when a note becomes mandatory. */
export function closesReport(status: ReportStatus): boolean {
  return CLOSING_REPORT_STATUSES.includes(status);
}

/** Trims the note so trailing whitespace never counts towards the minimum length. */
export function normaliseDecision(decision: TriageDecision): TriageDecision {
  return { status: decision.status, note: decision.note.trim() };
}

/**
 * An administrator must pick a real status, and must say why whenever they close a
 * report, so that the reason a concern was resolved or dismissed is always on record.
 * Notes on an open or in-progress report stay optional.
 */
export function validateTriageDecision(decision: TriageDecision, report: ReportRecord): TriageValidationResult {
  const clean = normaliseDecision(decision);
  const errors: Partial<Record<TriageField, string>> = {};

  if (!isReportStatus(clean.status)) {
    errors.status = 'Choose the status this report should move to.';
  } else if (clean.status === report.status && clean.note === report.adminNote.trim()) {
    errors.status = 'This report is already at that status. Change the status or add a note.';
  }

  if (closesReport(clean.status) && !clean.note) {
    errors.note = 'Record what was done before closing this report.';
  } else if (clean.note && clean.note.length < RESOLUTION_NOTE_MIN_LENGTH) {
    errors.note = `Please add a little more detail (at least ${RESOLUTION_NOTE_MIN_LENGTH} characters).`;
  } else if (clean.note.length > RESOLUTION_NOTE_MAX_LENGTH) {
    errors.note = `Please keep your note under ${RESOLUTION_NOTE_MAX_LENGTH} characters.`;
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * The history entry to append for a decision. `changedAt` is left for the caller to
 * stamp, because Firestore cannot resolve a server timestamp inside an array element.
 */
export function buildStatusChange(
  decision: TriageDecision,
  report: ReportRecord,
  adminUid: string,
): ReportStatusChange {
  const clean = normaliseDecision(decision);
  return {
    status: clean.status,
    previousStatus: report.status,
    note: clean.note,
    changedBy: adminUid,
  };
}

/** The full history after a decision is applied, oldest entry first. */
export function appendStatusChange(report: ReportRecord, change: ReportStatusChange): ReportStatusChange[] {
  return [...report.statusHistory, change];
}
