import { REPORT_CATEGORIES } from '../types/report';
import type { ReportCategory, ReportDraft, ReportSubject } from '../types/report';

export const DESCRIPTION_MIN_LENGTH = 20;
export const DESCRIPTION_MAX_LENGTH = 1500;

export type ReportField = 'category' | 'subject' | 'description';

export interface ReportValidationResult {
  valid: boolean;
  errors: Partial<Record<ReportField, string>>;
}

export function isReportCategory(value: unknown): value is ReportCategory {
  return REPORT_CATEGORIES.some((category) => category.value === value);
}

export function isUrgentCategory(category: ReportCategory): boolean {
  return REPORT_CATEGORIES.find((entry) => entry.value === category)?.urgent === true;
}

/** Trims the description and drops the subject when nothing was selected. */
export function normaliseDraft(draft: ReportDraft): ReportDraft {
  const subject: ReportSubject =
    draft.subject.type === 'none' || !draft.subject.id.trim()
      ? { type: 'none', id: '', label: '' }
      : { type: draft.subject.type, id: draft.subject.id.trim(), label: draft.subject.label.trim() };
  return { category: draft.category, subject, description: draft.description.trim() };
}

/**
 * A report needs a category and a meaningful description. The subject is optional
 * ("where applicable"), but a subject type without an id is an incomplete selection.
 */
export function validateReportDraft(draft: ReportDraft): ReportValidationResult {
  const normalised = normaliseDraft(draft);
  const errors: Partial<Record<ReportField, string>> = {};

  if (!normalised.category || !isReportCategory(normalised.category)) {
    errors.category = 'Choose the category that best describes your concern.';
  }

  if (draft.subject.type !== 'none' && !normalised.subject.id) {
    errors.subject = 'Select the person or activity this report is about, or choose "Not about a specific person or activity".';
  }

  if (!normalised.description) {
    errors.description = 'Describe what happened so an administrator can investigate.';
  } else if (normalised.description.length < DESCRIPTION_MIN_LENGTH) {
    errors.description = `Please add a little more detail (at least ${DESCRIPTION_MIN_LENGTH} characters).`;
  } else if (normalised.description.length > DESCRIPTION_MAX_LENGTH) {
    errors.description = `Please keep your description under ${DESCRIPTION_MAX_LENGTH} characters.`;
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function emptyDraft(): ReportDraft {
  return { category: null, subject: { type: 'none', id: '', label: '' }, description: '' };
}
