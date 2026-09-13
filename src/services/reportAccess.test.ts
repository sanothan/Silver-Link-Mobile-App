/// <reference types="jest" />
import { ReportAccessError, assertCanListAllReports, canListAllReports, redactReporter } from './reportAccess';
import type { ReportRecord } from '../types/report';

const report: ReportRecord = {
  id: 'report-1',
  category: 'unsafe_behaviour',
  urgent: true,
  subject: { type: 'user', id: 'volunteer-1', label: 'Alex Fernando' },
  description: 'Left my father alone outside the clinic.',
  status: 'open',
  reporterId: 'elderly-7',
  reporterRole: 'elderly',
  adminNote: '',
};

it('lets only administrators list every report', () => {
  expect(canListAllReports({ uid: 'admin-1', role: 'admin' })).toBe(true);
  expect(canListAllReports({ uid: 'volunteer-1', role: 'volunteer' })).toBe(false);
  expect(canListAllReports(null)).toBe(false);
  expect(() => assertCanListAllReports({ uid: 'caregiver-2', role: 'caregiver' })).toThrow(ReportAccessError);
  expect(() => assertCanListAllReports({ uid: 'admin-1', role: 'admin' })).not.toThrow();
});

it('hides the reporter from everyone except administrators', () => {
  expect(redactReporter(report, { uid: 'admin-1', role: 'admin' })).toEqual(report);

  const reportedUserView = redactReporter(report, { uid: 'volunteer-1', role: 'volunteer' });
  expect(reportedUserView.reporterId).toBeNull();
  expect(reportedUserView.reporterRole).toBeNull();
  expect(reportedUserView.description).toBe(report.description);

  expect(redactReporter(report, null).reporterId).toBeNull();
});
