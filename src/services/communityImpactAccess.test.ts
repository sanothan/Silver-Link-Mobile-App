/// <reference types="jest" />
import {
  CommunityImpactAccessError,
  assertCanViewCommunityImpact,
  canViewCommunityImpact,
} from './communityImpactAccess';

it('lets an administrator view the dashboard', () => {
  expect(canViewCommunityImpact({ uid: 'admin-1', role: 'admin' })).toBe(true);
});

it('keeps every other role out, including a signed-out visitor', () => {
  expect(canViewCommunityImpact({ uid: 'v-1', role: 'volunteer' })).toBe(false);
  expect(canViewCommunityImpact({ uid: 'e-1', role: 'elderly' })).toBe(false);
  expect(canViewCommunityImpact({ uid: 'c-1', role: 'caregiver' })).toBe(false);
  expect(canViewCommunityImpact({ uid: 'u-1', role: '' })).toBe(false);
  expect(canViewCommunityImpact(null)).toBe(false);
});

it('throws for a non-administrator so no read is attempted', () => {
  expect(() => assertCanViewCommunityImpact({ uid: 'v-1', role: 'volunteer' })).toThrow(
    CommunityImpactAccessError,
  );
  expect(() => assertCanViewCommunityImpact(null)).toThrow(CommunityImpactAccessError);
  expect(() => assertCanViewCommunityImpact({ uid: 'admin-1', role: 'admin' })).not.toThrow();
});
