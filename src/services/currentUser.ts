import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';
import type { ReportViewer } from './reportAccess';

/**
 * The signed-in user and their role. The role lives on `users/{uid}` and falls back to
 * an empty string, which no access check treats as privileged.
 */
export async function getCurrentViewer(): Promise<ReportViewer | null> {
  const user = auth?.currentUser;
  if (!user) return null;
  let role = '';
  try {
    const profile = await getDoc(doc(db, 'users', user.uid));
    const data = profile.exists() ? profile.data() : undefined;
    if (data && typeof data.role === 'string') role = data.role;
  } catch {
    role = '';
  }
  return { uid: user.uid, role };
}
