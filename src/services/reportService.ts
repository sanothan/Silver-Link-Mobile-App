import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit as queryLimit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { assertCanListAllReports, redactReporters } from './reportAccess';
import type { ReportViewer } from './reportAccess';
import {
  appendStatusChange,
  buildStatusChange,
  closesReport,
  isReportStatus,
  normaliseDecision,
  validateTriageDecision,
} from './reportTriage';
import type { TriageDecision, TriageValidationResult } from './reportTriage';
import { isUrgentCategory, normaliseDraft, validateReportDraft } from './reportValidation';
import type {
  ReportDraft,
  ReportRecord,
  ReportStatus,
  ReportStatusChange,
  ReportSubject,
  ReportSubjectOption,
  ReportSubjectType,
} from '../types/report';
import { REPORT_CATEGORIES } from '../types/report';

const REPORTS_COLLECTION = 'reports';

export class ReportValidationError extends Error {
  readonly errors: ReturnType<typeof validateReportDraft>['errors'];

  constructor(errors: ReturnType<typeof validateReportDraft>['errors']) {
    super('The report is missing required information.');
    this.name = 'ReportValidationError';
    this.errors = errors;
  }
}

export class TriageValidationError extends Error {
  readonly errors: TriageValidationResult['errors'];

  constructor(errors: TriageValidationResult['errors']) {
    super('The status update is missing required information.');
    this.name = 'TriageValidationError';
    this.errors = errors;
  }
}

export class ReportNotFoundError extends Error {
  constructor() {
    super('This report no longer exists.');
    this.name = 'ReportNotFoundError';
  }
}

function asDate(value: unknown): Date | undefined {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  if (value instanceof Date) return value;
  return undefined;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asStatus(value: unknown): ReportStatus {
  return value === 'under_review' || value === 'resolved' || value === 'dismissed' ? value : 'open';
}

function asSubject(value: unknown): ReportSubject {
  const raw = (value ?? {}) as Record<string, unknown>;
  const type = raw.type === 'user' || raw.type === 'activity' ? (raw.type as ReportSubjectType) : 'none';
  if (type === 'none') return { type: 'none', id: '', label: '' };
  return { type, id: asText(raw.id), label: asText(raw.label) };
}

/** Reads back the stored audit trail, skipping any entry that is not a usable change. */
function asStatusHistory(value: unknown): ReportStatusChange[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const raw = (entry ?? {}) as Record<string, unknown>;
    if (!isReportStatus(raw.status)) return [];
    return [
      {
        status: raw.status,
        previousStatus: isReportStatus(raw.previousStatus) ? raw.previousStatus : 'open',
        note: asText(raw.note),
        changedBy: asText(raw.changedBy),
        changedAt: asDate(raw.changedAt),
      },
    ];
  });
}

function toRecord(id: string, data: Record<string, unknown>): ReportRecord {
  const category = REPORT_CATEGORIES.find((entry) => entry.value === data.category)?.value ?? 'other';
  return {
    id,
    category,
    urgent: data.urgent === true,
    subject: asSubject(data.subject),
    description: asText(data.description),
    status: asStatus(data.status),
    reporterId: asText(data.reporterId) || null,
    reporterRole: asText(data.reporterRole) || null,
    createdAt: asDate(data.createdAt),
    resolvedAt: asDate(data.resolvedAt),
    adminNote: asText(data.adminNote),
    statusHistory: asStatusHistory(data.statusHistory),
    lastUpdatedBy: asText(data.lastUpdatedBy) || null,
    updatedAt: asDate(data.updatedAt),
  };
}

/**
 * Validates and stores a report with `open` status. Throws ReportValidationError when
 * required information is missing, so the caller can highlight the offending fields.
 */
export async function submitReport(draft: ReportDraft, reporter: ReportViewer): Promise<string> {
  if (!db) throw new Error('Firebase is not configured.');
  const result = validateReportDraft(draft);
  if (!result.valid) throw new ReportValidationError(result.errors);

  const clean = normaliseDraft(draft);
  const created = await addDoc(collection(db, REPORTS_COLLECTION), {
    category: clean.category,
    urgent: isUrgentCategory(clean.category!),
    subject: clean.subject,
    description: clean.description,
    status: 'open' satisfies ReportStatus,
    reporterId: reporter.uid,
    reporterRole: reporter.role,
    adminNote: '',
    statusHistory: [],
    lastUpdatedBy: null,
    createdAt: serverTimestamp(),
  });
  return created.id;
}

/** Administrator view of every report, newest first. */
export async function getReportsForAdmin(viewer: ReportViewer | null, status?: ReportStatus): Promise<ReportRecord[]> {
  if (!db) throw new Error('Firebase is not configured.');
  assertCanListAllReports(viewer);

  const constraints = status ? [where('status', '==', status)] : [];
  const snapshot = await getDocs(query(collection(db, REPORTS_COLLECTION), ...constraints));
  return snapshot.docs
    .map((item) => toRecord(item.id, item.data() as Record<string, unknown>))
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
}

/** The reports a person submitted themselves, with reporter identity stripped. */
export async function getMyReports(viewer: ReportViewer | null): Promise<ReportRecord[]> {
  if (!db) throw new Error('Firebase is not configured.');
  if (!viewer) return [];
  const snapshot = await getDocs(query(collection(db, REPORTS_COLLECTION), where('reporterId', '==', viewer.uid)));
  const records = snapshot.docs
    .map((item) => toRecord(item.id, item.data() as Record<string, unknown>))
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  return redactReporters(records, viewer);
}

/** A single report with its full triage history. Administrators only. */
export async function getReportForAdmin(viewer: ReportViewer | null, id: string): Promise<ReportRecord> {
  if (!db) throw new Error('Firebase is not configured.');
  assertCanListAllReports(viewer);

  const snapshot = await getDoc(doc(db, REPORTS_COLLECTION, id));
  if (!snapshot.exists()) throw new ReportNotFoundError();
  return toRecord(snapshot.id, snapshot.data() as Record<string, unknown>);
}

/**
 * Stores an administrator's decision: the new status, the resolution note, and an entry
 * appended to `statusHistory` so the trail of who changed what survives later edits.
 * Throws TriageValidationError when the decision is incomplete, so the caller can
 * highlight the offending field rather than writing a half-finished update.
 */
export async function applyReportTriage(
  viewer: ReportViewer | null,
  report: ReportRecord,
  decision: TriageDecision,
): Promise<ReportRecord> {
  if (!db) throw new Error('Firebase is not configured.');
  assertCanListAllReports(viewer);

  const result = validateTriageDecision(decision, report);
  if (!result.valid) throw new TriageValidationError(result.errors);

  const clean = normaliseDecision(decision);
  // serverTimestamp() is rejected inside an array element, so the entry carries a client
  // timestamp while the document's own `updatedAt` stays server authored.
  const change: ReportStatusChange = { ...buildStatusChange(clean, report, viewer.uid), changedAt: new Date() };
  const history = appendStatusChange(report, change);

  await updateDoc(doc(db, REPORTS_COLLECTION, report.id), {
    status: clean.status,
    adminNote: clean.note,
    lastUpdatedBy: viewer.uid,
    statusHistory: history.map((entry) => ({
      status: entry.status,
      previousStatus: entry.previousStatus,
      note: entry.note,
      changedBy: entry.changedBy,
      changedAt: entry.changedAt ? Timestamp.fromDate(entry.changedAt) : Timestamp.now(),
    })),
    updatedAt: serverTimestamp(),
    ...(closesReport(clean.status) ? { resolvedAt: serverTimestamp() } : {}),
  });

  return {
    ...report,
    status: clean.status,
    adminNote: clean.note,
    lastUpdatedBy: viewer.uid,
    statusHistory: history,
    updatedAt: new Date(),
    ...(closesReport(clean.status) ? { resolvedAt: new Date() } : {}),
  };
}

/**
 * People and activities the reporter can point at. Reads are best effort: an empty list
 * simply means the reporter files the report without a subject.
 */
export async function getReportSubjectOptions(viewer: ReportViewer | null): Promise<ReportSubjectOption[]> {
  if (!db || !viewer) return [];
  const options: ReportSubjectOption[] = [];

  try {
    const users = await getDocs(query(collection(db, 'users'), queryLimit(50)));
    users.docs.forEach((item) => {
      if (item.id === viewer.uid) return;
      const data = item.data() as Record<string, unknown>;
      const label = asText(data.fullName) || asText(data.name) || asText(data.email) || 'SilverLink member';
      options.push({ type: 'user', id: item.id, label, detail: asText(data.role) || 'member' });
    });
  } catch {
    // Listing members is optional; the form still works without it.
  }

  try {
    const requests = await getDocs(query(collection(db, 'requests'), orderBy('createdAt', 'desc'), queryLimit(25)));
    requests.docs.forEach((item) => {
      const data = item.data() as Record<string, unknown>;
      const label = asText(data.title) || asText(data.activityType) || 'Activity request';
      options.push({ type: 'activity', id: item.id, label, detail: asText(data.status) || 'activity' });
    });
  } catch {
    // Same here: activities are only offered when they can be read.
  }

  return options;
}
