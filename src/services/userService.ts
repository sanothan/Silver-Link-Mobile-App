import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { auth, db } from './firebaseConfig';
import type { TrustedContact, UserProfile } from '../types/user';
import { normalizeActivityTypes } from '../types/request';
import type { VolunteerPreferences } from '../types/volunteer';

/** Profile-wide interests; availability records keep their own per-slot preferences. */
export async function getVolunteerPreferences(uid: string): Promise<VolunteerPreferences> {
  if (!db || auth?.currentUser?.uid !== uid) throw new Error('You are not signed in.');
  const snapshot = await getDoc(doc(db, 'volunteerProfiles', uid));
  return { preferredActivityTypes: normalizeActivityTypes(snapshot.data()?.preferredActivityTypes) };
}

export async function saveVolunteerInterests(uid: string, interests: string[]): Promise<void> {
  if (!db || auth?.currentUser?.uid !== uid) throw new Error('You are not signed in.');
  const profile = await getUserProfile(uid);
  if (profile.role !== 'volunteer' || profile.status === 'suspended')
    throw new Error('Only volunteers can save activity interests.');
  await setDoc(doc(db, 'volunteerProfiles', uid), {
    preferredActivityTypes: normalizeActivityTypes(interests), updatedAt: serverTimestamp(),
  }, { merge: true });
}

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
    caregiverLinkId: typeof data.caregiverLinkId === 'string' ? data.caregiverLinkId : undefined,
    phone: typeof data.phone === 'string' ? data.phone : undefined,
    locality: typeof data.locality === 'string' ? data.locality : undefined,
    preferredLanguage: typeof data.preferredLanguage === 'string' ? data.preferredLanguage : undefined,
    photoUrl: typeof data.photoUrl === 'string' ? data.photoUrl : undefined,
    trustedContact:
      data.trustedContact && typeof data.trustedContact === 'object'
        ? {
            name: typeof data.trustedContact.name === 'string' ? data.trustedContact.name : '',
            relationship: typeof data.trustedContact.relationship === 'string' ? data.trustedContact.relationship : '',
            phone: typeof data.trustedContact.phone === 'string' ? data.trustedContact.phone : '',
            ...(typeof data.trustedContact.email === 'string' && data.trustedContact.email.trim()
              ? { email: data.trustedContact.email }
              : {}),
          }
        : undefined,
  };
}

export type UserManagedProfile = { fullName: string; phone?: string; locality?: string; preferredLanguage?: string };
export async function ensureElderlyDirectoryProfile(profile: UserProfile) {
  if (!db || profile.role !== 'elderly') return;
  await setDoc(doc(db, 'elderlyDirectory', profile.uid), {
    uid: profile.uid,
    fullName: profile.fullName,
    email: profile.email.trim().toLowerCase(),
    role: 'elderly',
    ...(profile.photoUrl && { photoUrl: profile.photoUrl }),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}
export async function updateUserProfile(uid: string, values: UserManagedProfile) {
  if (!db || !auth?.currentUser || auth.currentUser.uid !== uid) throw new Error('You are not signed in.');
  const clean = { fullName: values.fullName.trim(), phone: values.phone?.trim() || null, locality: values.locality?.trim() || null, preferredLanguage: values.preferredLanguage?.trim() || null, updatedAt: serverTimestamp() };
  await updateDoc(doc(db, 'users', uid), clean);
  await updateProfile(auth.currentUser, { displayName: clean.fullName });
}

export async function updateTrustedContact(
  caregiverUid: string,
  elderlyUid: string,
  trustedContact: TrustedContact | null,
) {
  if (!db || !auth?.currentUser || auth.currentUser.uid !== caregiverUid)
    throw new Error('You are not signed in.');
  const { hasAcceptedCaregiverLink } = await import('./caregiverLinkService');
  if (!(await hasAcceptedCaregiverLink(caregiverUid, elderlyUid)))
    throw new Error('You need an accepted caregiver connection.');
  await updateDoc(doc(db, 'users', elderlyUid), {
    trustedContact,
    updatedAt: serverTimestamp(),
  });
}
