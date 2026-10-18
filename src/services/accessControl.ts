import type { Href } from 'expo-router';
import type { UserProfile, UserRole } from '../types/user';

export const ROLE_HOME: Record<UserRole, Href> = {
  elderly: '/(elderly)' as Href,
  volunteer: '/(volunteer)' as Href,
  caregiver: '/home' as Href,
  admin: '/(admin)' as Href,
};

export const ROLE_ROUTE_SEGMENT: Record<UserRole, string> = {
  elderly: '(elderly)',
  volunteer: '(volunteer)',
  caregiver: 'home',
  admin: '(admin)',
};

export function canEnterDashboard(profile: UserProfile) {
  return profile.status === 'active' || (profile.role === 'volunteer' && profile.status === 'pending');
}

export function roleForProtectedSegments(segments: readonly string[]): UserRole | null {
  if (segments.some((segment) =>
    ['caregiver-elderly-requests', 'caregiver-request-details', 'caregiver-trusted-contact', 'caregiver-volunteer-chat'].includes(segment),
  )) return 'caregiver';
  return (Object.keys(ROLE_ROUTE_SEGMENT) as UserRole[]).find((role) =>
    segments.includes(ROLE_ROUTE_SEGMENT[role])) ?? null;
}
