/// <reference types="jest" />
import {
  VolunteerRatingAccessError,
  assertCanRateVolunteer,
  canRateVolunteer,
  hasRateableVolunteer,
  isTheVolunteer,
  raterRoleFor,
  rateableActivities,
} from './volunteerRatingAccess';
import type { ActivitySummary } from '../types/feedback';
import type { VolunteerRatingRecord } from '../types/volunteerRating';

const completed: ActivitySummary = {
  id: 'activity-1',
  title: 'Trip to the pharmacy',
  status: 'completed',
  participantIds: ['elderly-7', 'caregiver-2', 'volunteer-1'],
  volunteerId: 'volunteer-1',
  elderlyId: 'elderly-7',
};

const inProgress: ActivitySummary = { ...completed, id: 'activity-2', status: 'in_progress' };
const unassigned: ActivitySummary = {
  ...completed,
  id: 'activity-3',
  volunteerId: null,
  participantIds: ['elderly-7', 'caregiver-2'],
};

const elderly = { uid: 'elderly-7', role: 'elderly' };
const caregiver = { uid: 'caregiver-2', role: 'caregiver' };
const volunteer = { uid: 'volunteer-1', role: 'volunteer' };
const stranger = { uid: 'volunteer-9', role: 'volunteer' };

const existingRating: VolunteerRatingRecord = {
  id: 'activity-1__elderly-7',
  activityId: 'activity-1',
  activityTitle: 'Trip to the pharmacy',
  volunteerId: 'volunteer-1',
  score: 5,
  comment: 'Patient and kind throughout.',
  raterId: 'elderly-7',
  raterRole: 'elderly',
};

it('opens rating only once the activity is completed', () => {
  const tooEarly = canRateVolunteer(inProgress, elderly);
  expect(tooEarly.allowed).toBe(false);
  expect(tooEarly.reason).toBe('not-completed');

  expect(canRateVolunteer({ ...completed, status: 'cancelled' }, elderly).reason).toBe('not-completed');
  expect(canRateVolunteer(completed, elderly).allowed).toBe(true);
});

it('needs a volunteer to rate', () => {
  expect(hasRateableVolunteer(completed)).toBe(true);
  expect(hasRateableVolunteer(unassigned)).toBe(false);
  expect(canRateVolunteer(unassigned, elderly).reason).toBe('no-volunteer');
});

it('lets the elderly member and their caregiver rate the volunteer', () => {
  expect(canRateVolunteer(completed, elderly).allowed).toBe(true);
  expect(canRateVolunteer(completed, caregiver).allowed).toBe(true);
  expect(() => assertCanRateVolunteer(completed, caregiver)).not.toThrow();
});

it('refuses a rating from somebody who took no part', () => {
  const refused = canRateVolunteer(completed, stranger);
  expect(refused.allowed).toBe(false);
  expect(refused.reason).toBe('not-a-participant');
  expect(() => assertCanRateVolunteer(completed, stranger)).toThrow(VolunteerRatingAccessError);
});

it('refuses a signed-out visitor', () => {
  expect(canRateVolunteer(completed, null).reason).toBe('signed-out');
});

it('stops a volunteer rating themselves', () => {
  expect(isTheVolunteer(completed, volunteer)).toBe(true);
  expect(canRateVolunteer(completed, volunteer).reason).toBe('self-rating');
});

it('prevents a second rating of the same volunteer for the same activity', () => {
  const duplicate = canRateVolunteer(completed, elderly, existingRating);
  expect(duplicate.allowed).toBe(false);
  expect(duplicate.reason).toBe('already-rated');
  expect(() => assertCanRateVolunteer(completed, elderly, existingRating)).toThrow(/already rated/i);
});

it('records how the rater took part', () => {
  expect(raterRoleFor(completed, elderly)).toBe('elderly');
  expect(raterRoleFor(completed, caregiver)).toBe('caregiver');
  expect(raterRoleFor(completed, { uid: 'someone', role: 'admin' })).toBe('other');
});

it('offers only the activities a person may rate', () => {
  const offered = rateableActivities([completed, inProgress, unassigned], elderly);
  expect(offered.map((activity) => activity.id)).toEqual(['activity-1']);
  expect(rateableActivities([completed], volunteer)).toEqual([]);
  expect(rateableActivities([completed], null)).toEqual([]);
});
