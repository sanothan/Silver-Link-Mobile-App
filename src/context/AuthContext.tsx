import { onAuthStateChanged, type User } from 'firebase/auth';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { auth } from '../services/firebaseConfig';
import { ensureElderlyDirectoryProfile, getUserProfile, UserProfileError, type ProfileIssue } from '../services/userService';
import type { UserProfile } from '../types/user';

type AuthContextValue = {
  user: User | null;
  initializing: boolean;
  profile: UserProfile | null;
  profileError: string | null;
  profileIssue: ProfileIssue | null;
  retryProfile: (uid?: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(Boolean(auth));
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileIssue, setProfileIssue] = useState<ProfileIssue | null>(null);

  async function loadProfile(uid: string) {
    setProfileError(null);
    setProfileIssue(null);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const loadedProfile = await getUserProfile(uid);
        setProfile(loadedProfile);
        await ensureElderlyDirectoryProfile(loadedProfile).catch((error) =>
          console.warn('[auth] Unable to refresh the elderly directory entry.', error),
        );
        return;
      } catch (error) {
        if (attempt < 2) {
          await wait(250 * (attempt + 1));
          continue;
        }
        console.warn('[auth] Unable to load user profile after retries.', error);
        setProfile(null);
        const issue = error instanceof UserProfileError ? error.issue : 'load-failed';
        setProfileIssue(issue);
        setProfileError(issue === 'missing-profile'
          ? 'Your account is signed in, but its SilverLink profile is missing.'
          : issue === 'invalid-role' || issue === 'invalid-status'
            ? 'Your account profile needs administrator attention.'
            : "We couldn't load your account information. Check that the latest Firestore rules are deployed.");
      }
    }
  }

  async function retryProfile(uid?: string) {
    const profileUid = uid ?? user?.uid;
    if (!profileUid) return;
    await loadProfile(profileUid);
  }

  useEffect(() => {
    if (!auth) {
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setInitializing(true);
      setUser(nextUser);
      setProfile(null);
      setProfileError(null);
      setProfileIssue(null);
      if (nextUser) await loadProfile(nextUser.uid);
      setInitializing(false);
    });
    return unsubscribe;
  }, []);

  return <AuthContext.Provider value={{ user, initializing, profile, profileError, profileIssue, retryProfile }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
