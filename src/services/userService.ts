import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { auth, db } from './firebaseConfig';
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
    phone: typeof data.phone === 'string' ? data.phone : undefined,
    locality: typeof data.locality === 'string' ? data.locality : undefined,
    preferredLanguage: typeof data.preferredLanguage === 'string' ? data.preferredLanguage : undefined,
    photoUrl: typeof data.photoUrl === 'string' ? data.photoUrl : undefined,
  };
}

export type UserManagedProfile = { fullName: string; phone?: string; locality?: string; preferredLanguage?: string };
export async function updateUserProfile(uid: string, values: UserManagedProfile) {
  if (!db || !auth?.currentUser || auth.currentUser.uid !== uid) throw new Error('You are not signed in.');
  const clean = { fullName: values.fullName.trim(), phone: values.phone?.trim() || null, locality: values.locality?.trim() || null, preferredLanguage: values.preferredLanguage?.trim() || null, updatedAt: serverTimestamp() };
  await updateDoc(doc(db, 'users', uid), clean);
  await updateProfile(auth.currentUser, { displayName: clean.fullName });
}
