import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';
import type { UserProfile } from '../types/user';

export type ProfileIssue = 'missing-profile' | 'invalid-role' | 'invalid-status' | 'load-failed';

export class UserProfileError extends Error {
  constructor(public readonly issue: ProfileIssue, message: string) {
    super(message);
    this.name = 'UserProfileError';
  }
}

const USER_ROLES = ['elderly', 'volunteer', 'caregiver', 'admin'] as const;
const USER_STATUSES = ['active', 'pending', 'suspended'] as const;

export async function getUserProfile(uid: string): Promise<UserProfile> {
  if (!db) throw new Error('Firebase is not configured.');
  const snapshot = await getDoc(doc(db, 'users', uid));
  if (!snapshot.exists()) {
    throw new UserProfileError('missing-profile', 'No user profile exists for this account.');
  }
  const data = snapshot.data();
  if (!USER_ROLES.includes(data.role)) {
    throw new UserProfileError('invalid-role', 'The user profile has an unsupported role.');
  }
  if (!USER_STATUSES.includes(data.status)) {
    throw new UserProfileError('invalid-status', 'The user profile has an unsupported status.');
  }
  return {
    uid: snapshot.id,
    fullName: typeof data.fullName === 'string' ? data.fullName : '',
    email: typeof data.email === 'string' ? data.email : '',
    role: data.role,
    status: data.status,
    caregiverId: typeof data.caregiverId === 'string' ? data.caregiverId : undefined,
  };
}
