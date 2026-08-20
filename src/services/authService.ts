import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';

export type UserRole = 'Older adult' | 'Family member' | 'Caregiver';

export type RegisterInput = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
};

function friendlyAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

export async function registerUser({ fullName, email, phone, password, role }: RegisterInput) {
  try {
    const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateProfile(credential.user, { displayName: fullName.trim() });
    await setDoc(doc(db, 'users', credential.user.uid), {
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      role,
      createdAt: serverTimestamp(),
    });
    return credential.user;
  } catch (error) {
    throw new Error(friendlyAuthError(error));
  }
}

export async function loginUser(email: string, password: string) {
  try {
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
    return credential.user;
  } catch (error) {
    throw new Error(friendlyAuthError(error));
  }
}

export async function logoutUser() {
  await signOut(auth);
}
