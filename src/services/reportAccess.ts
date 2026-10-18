import type { ReportRecord } from '../types/report';

export interface ReportViewer {
  uid: string;
  role: string;
}

export class ReportAccessError extends Error {
  constructor(message = 'You are not allowed to view safety reports.') {
    super(message);
    this.name = 'ReportAccessError';
  }
}

export function isAdmin(viewer: ReportViewer | null): boolean {
  return viewer?.role === 'admin';
}

/** Only administrators may list reports; everyone else can read back their own submissions. */
export function canListAllReports(viewer: ReportViewer | null): boolean {
  return isAdmin(viewer);
}

/** Narrows the viewer to a signed-in administrator, so callers can rely on their uid. */
export function assertCanListAllReports(viewer: ReportViewer | null): asserts viewer is ReportViewer {
  if (!canListAllReports(viewer)) throw new ReportAccessError();
}

/**
 * Strips the reporter's identity for anybody who is not an administrator.
 * Reports are returned to the reporter themselves without their own id echoed back,
 * because nothing in the UI needs it and leaving it out keeps the field off screen.
 */
export function redactReporter(report: ReportRecord, viewer: ReportViewer | null): ReportRecord {
  if (isAdmin(viewer)) return report;
  return { ...report, reporterId: null, reporterRole: null };
}

export function redactReporters(reports: ReportRecord[], viewer: ReportViewer | null): ReportRecord[] {
  return reports.map((report) => redactReporter(report, viewer));
}
