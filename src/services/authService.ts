import { createUserWithEmailAndPassword, deleteUser, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';

export type UserRole = 'elderly' | 'volunteer' | 'caregiver';
export type RegisterInput = { fullName: string; email: string; password: string; role: UserRole };

function requireFirebase() {
  if (!auth || !db) throw new Error('Authentication is not configured yet. Add the Firebase environment values and try again.');
  return { auth, db };
}

function friendlyAuthError(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  switch (code) {
    case 'auth/email-already-in-use': return 'An account with this email already exists.';
    case 'auth/invalid-email': return 'Please enter a valid email address.';
    case 'auth/weak-password': return 'Use a password with at least 8 characters.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found': return 'The email or password is incorrect.';
    case 'auth/too-many-requests': return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed': return 'Check your internet connection and try again.';
    default: return 'We could not complete that request. Please try again.';
  }
}

export async function registerUser({ fullName, email, password, role }: RegisterInput) {
  const firebase = requireFirebase();
  let createdUser: Awaited<ReturnType<typeof createUserWithEmailAndPassword>>['user'] | null = null;
  try {
    const credential = await createUserWithEmailAndPassword(firebase.auth, email.trim().toLowerCase(), password);
    createdUser = credential.user;
    await updateProfile(createdUser, { displayName: fullName.trim() });
    await setDoc(doc(firebase.db, 'users', createdUser.uid), {
      uid: createdUser.uid,
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      role,
      status: role === 'volunteer' ? 'pending' : 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return createdUser;
  } catch (error) {
    if (createdUser) await deleteUser(createdUser).catch(() => undefined);
    throw new Error(friendlyAuthError(error));
  }
}

export async function loginUser(email: string, password: string) {
  const firebase = requireFirebase();
  try {
    return (await signInWithEmailAndPassword(firebase.auth, email.trim().toLowerCase(), password)).user;
  } catch (error) {
    throw new Error(friendlyAuthError(error));
  }
}

export async function requestPasswordReset(email: string) {
  const firebase = requireFirebase();
  try {
    await sendPasswordResetEmail(firebase.auth, email.trim().toLowerCase());
  } catch (error) {
    throw new Error(friendlyAuthError(error));
  }
}

export async function logoutUser() { if (auth) await signOut(auth); }
