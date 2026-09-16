/// <reference types="jest" />
import {
  FeedbackAccessError,
  assertCanSubmitFeedback,
  authorRoleFor,
  canSubmitFeedback,
  feedbackEligibleActivities,
  isActivityCompleted,
  isActivityParticipant,
} from './feedbackAccess';
import type { ActivitySummary, FeedbackRecord } from '../types/feedback';

const completed: ActivitySummary = {
  id: 'activity-1',
  title: 'Trip to the pharmacy',
  status: 'completed',
  participantIds: ['elderly-7', 'caregiver-2', 'volunteer-1'],
  volunteerId: 'volunteer-1',
  elderlyId: 'elderly-7',
};

const inProgress: ActivitySummary = { ...completed, id: 'activity-2', status: 'in_progress' };

const elderly = { uid: 'elderly-7', role: 'elderly' };
const caregiver = { uid: 'caregiver-2', role: 'caregiver' };
const stranger = { uid: 'volunteer-9', role: 'volunteer' };
const admin = { uid: 'admin-1', role: 'admin' };

const existingFeedback: FeedbackRecord = {
  id: 'feedback-1',
  activityId: 'activity-1',
  activityTitle: 'Trip to the pharmacy',
  rating: 5,
  comment: 'The volunteer was patient and kind throughout.',
  authorId: 'elderly-7',
  authorRole: 'elderly',
};

it('opens feedback only once an activity is completed', () => {
  expect(isActivityCompleted(completed)).toBe(true);
  expect(isActivityCompleted(inProgress)).toBe(false);
  expect(isActivityCompleted({ ...completed, status: 'cancelled' })).toBe(false);

  const tooEarly = canSubmitFeedback(inProgress, elderly);
  expect(tooEarly.allowed).toBe(false);
  expect(tooEarly.reason).toBe('not-completed');
});

it('lets the people who took part leave feedback', () => {
  expect(isActivityParticipant(completed, elderly)).toBe(true);
  expect(isActivityParticipant(completed, caregiver)).toBe(true);
  expect(canSubmitFeedback(completed, caregiver).allowed).toBe(true);
  expect(() => assertCanSubmitFeedback(completed, elderly)).not.toThrow();
});

it('refuses feedback on an unrelated activity', () => {
  expect(isActivityParticipant(completed, stranger)).toBe(false);

  const refused = canSubmitFeedback(completed, stranger);
  expect(refused.allowed).toBe(false);
  expect(refused.reason).toBe('not-a-participant');
  expect(() => assertCanSubmitFeedback(completed, stranger)).toThrow(FeedbackAccessError);

  // An administrator reads feedback; they do not author it for somebody else.
  expect(canSubmitFeedback(completed, admin).reason).toBe('not-a-participant');
});

it('refuses feedback when nobody is signed in', () => {
  expect(canSubmitFeedback(completed, null).reason).toBe('signed-out');
  expect(isActivityParticipant(completed, null)).toBe(false);
});

it('refuses a second piece of feedback from the same person', () => {
  const repeat = canSubmitFeedback(completed, elderly, existingFeedback);
  expect(repeat.allowed).toBe(false);
  expect(repeat.reason).toBe('already-submitted');
  expect(canSubmitFeedback(completed, elderly, null).allowed).toBe(true);
});

it('records how the author took part', () => {
  expect(authorRoleFor(completed, { uid: 'volunteer-1', role: 'volunteer' })).toBe('volunteer');
  expect(authorRoleFor(completed, elderly)).toBe('elderly');
  expect(authorRoleFor(completed, caregiver)).toBe('caregiver');
  expect(authorRoleFor(completed, { uid: 'someone-else', role: '' })).toBe('other');
});

it('offers only the completed activities the viewer took part in', () => {
  const activities = [completed, inProgress, { ...completed, id: 'activity-3', participantIds: ['volunteer-9'] }];

  expect(feedbackEligibleActivities(activities, elderly).map((a) => a.id)).toEqual(['activity-1']);
  expect(feedbackEligibleActivities(activities, stranger).map((a) => a.id)).toEqual(['activity-3']);
  expect(feedbackEligibleActivities(activities, null)).toEqual([]);
});
