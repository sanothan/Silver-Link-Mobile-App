/// <reference types="jest" />
import { emptyDraft, isUrgentCategory, normaliseDraft, validateReportDraft } from './reportValidation';
import type { ReportDraft } from '../types/report';

function draft(overrides: Partial<ReportDraft> = {}): ReportDraft {
  return {
    category: 'harassment',
    subject: { type: 'user', id: 'volunteer-1', label: 'Alex Fernando' },
    description: 'The volunteer kept shouting at my mother during the visit yesterday.',
    ...overrides,
  };
}

it('accepts a complete report and flags safety categories as urgent', () => {
  expect(validateReportDraft(draft())).toEqual({ valid: true, errors: {} });
  expect(isUrgentCategory('harassment')).toBe(true);
  expect(isUrgentCategory('no_show')).toBe(false);
});

it('requires a category and a description with enough detail', () => {
  expect(validateReportDraft(draft({ category: null })).errors.category).toBeDefined();
  expect(validateReportDraft(draft({ description: '   ' })).errors.description).toBeDefined();
  expect(validateReportDraft(draft({ description: 'Was rude' })).errors.description).toBeDefined();
  expect(validateReportDraft(draft({ description: 'x'.repeat(1501) })).errors.description).toBeDefined();
});

it('treats the subject as optional but rejects a half-made selection', () => {
  const withoutSubject = draft({ subject: { type: 'none', id: '', label: '' } });
  expect(validateReportDraft(withoutSubject).valid).toBe(true);

  const incomplete = draft({ subject: { type: 'activity', id: '   ', label: '' } });
  expect(validateReportDraft(incomplete).errors.subject).toBeDefined();
});

it('trims the description and clears an unselected subject', () => {
  const clean = normaliseDraft(
    draft({ description: '  Someone asked my father for his bank details.  ', subject: { type: 'user', id: ' u1 ', label: ' Sam ' } }),
  );
  expect(clean.description).toBe('Someone asked my father for his bank details.');
  expect(clean.subject).toEqual({ type: 'user', id: 'u1', label: 'Sam' });
  expect(normaliseDraft(emptyDraft()).subject).toEqual({ type: 'none', id: '', label: '' });
});
