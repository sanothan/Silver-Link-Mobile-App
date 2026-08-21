import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';
import type { UserProfile } from '../types/user';

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (!db) throw new Error('Firebase is not configured.');
  const snapshot = await getDoc(doc(db, 'users', uid));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return {
    uid: snapshot.id,
    fullName: typeof data.fullName === 'string' ? data.fullName : '',
    email: typeof data.email === 'string' ? data.email : '',
    role: data.role,
    status: data.status,
    caregiverId: typeof data.caregiverId === 'string' ? data.caregiverId : undefined,
  } as UserProfile;
}
