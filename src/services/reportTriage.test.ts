/// <reference types="jest" />
import {
  RESOLUTION_NOTE_MIN_LENGTH,
  appendStatusChange,
  buildStatusChange,
  closesReport,
  validateTriageDecision,
} from './reportTriage';
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
  statusHistory: [],
  lastUpdatedBy: null,
};

it('requires a resolution note before a report is closed', () => {
  expect(closesReport('resolved')).toBe(true);
  expect(closesReport('dismissed')).toBe(true);
  expect(closesReport('under_review')).toBe(false);

  const missingNote = validateTriageDecision({ status: 'resolved', note: '   ' }, report);
  expect(missingNote.valid).toBe(false);
  expect(missingNote.errors.note).toBeDefined();

  const withNote = validateTriageDecision({ status: 'resolved', note: 'Spoke to the volunteer and suspended them.' }, report);
  expect(withNote.valid).toBe(true);
});

it('accepts moving a report to review without a note, but rejects a too-short one', () => {
  expect(validateTriageDecision({ status: 'under_review', note: '' }, report).valid).toBe(true);

  const short = validateTriageDecision({ status: 'under_review', note: 'x'.repeat(RESOLUTION_NOTE_MIN_LENGTH - 1) }, report);
  expect(short.valid).toBe(false);
  expect(short.errors.note).toBeDefined();
});

it('rejects a decision that changes nothing', () => {
  const unchanged = validateTriageDecision({ status: 'open', note: '' }, report);
  expect(unchanged.valid).toBe(false);
  expect(unchanged.errors.status).toBeDefined();
});

it('records who changed the status, and from what, in order', () => {
  const first = buildStatusChange({ status: 'under_review', note: '  Calling the reporter back.  ' }, report, 'admin-1');
  expect(first).toEqual({
    status: 'under_review',
    previousStatus: 'open',
    note: 'Calling the reporter back.',
    changedBy: 'admin-1',
  });

  const reviewed: ReportRecord = { ...report, status: 'under_review', statusHistory: appendStatusChange(report, first) };
  const second = buildStatusChange({ status: 'resolved', note: 'Volunteer removed from the platform.' }, reviewed, 'admin-1');
  const history = appendStatusChange(reviewed, second);

  expect(history).toHaveLength(2);
  expect(history[0].status).toBe('under_review');
  expect(history[1].previousStatus).toBe('under_review');
  expect(history[1].status).toBe('resolved');
});
