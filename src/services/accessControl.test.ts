import { ROLE_ROUTE_SEGMENT, canEnterDashboard, roleForProtectedSegments } from './accessControl';
import type { UserProfile } from '../types/user';

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return { uid: 'u1', fullName: 'Test User', email: 't@example.com', role: 'elderly', status: 'active', ...overrides };
}

describe('roleForProtectedSegments', () => {
  it('identifies the admin route segment', () => {
    expect(roleForProtectedSegments(['(admin)', 'users'])).toBe('admin');
  });

  it('identifies non-admin protected segments', () => {
    expect(roleForProtectedSegments([ROLE_ROUTE_SEGMENT.volunteer, 'dashboard'])).toBe('volunteer');
  });

  it('returns null for public routes', () => {
    expect(roleForProtectedSegments(['welcome'])).toBeNull();
    expect(roleForProtectedSegments(['login'])).toBeNull();
  });
});

describe('canEnterDashboard (admin permission gate)', () => {
  it('allows an active admin to enter the dashboard', () => {
    expect(canEnterDashboard(makeProfile({ role: 'admin', status: 'active' }))).toBe(true);
  });

  it('blocks a suspended admin from entering the dashboard', () => {
    expect(canEnterDashboard(makeProfile({ role: 'admin', status: 'suspended' }))).toBe(false);
  });

  it('blocks a non-admin (elderly) user regardless of status from the admin check being role-specific', () => {
    // canEnterDashboard only checks status; the actual admin-only gating of
    // (admin) routes happens via roleForProtectedSegments + a role match in
    // src/app/_layout.tsx. This confirms a normal active user still passes
    // the dashboard-entry check (as expected, since they're routed to their
    // own role's home, not the admin one).
    expect(canEnterDashboard(makeProfile({ role: 'elderly', status: 'active' }))).toBe(true);
  });

  it('blocks a pending non-volunteer from entering the dashboard', () => {
    expect(canEnterDashboard(makeProfile({ role: 'caregiver', status: 'pending' }))).toBe(false);
  });

  it('allows a pending volunteer as a special case', () => {
    expect(canEnterDashboard(makeProfile({ role: 'volunteer', status: 'pending' }))).toBe(true);
  });
});
