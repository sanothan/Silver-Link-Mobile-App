import { onAuthStateChanged, type User } from 'firebase/auth';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { auth } from '../services/firebaseConfig';
import { getUserProfile } from '../services/userService';
import type { UserProfile } from '../types/user';

type AuthContextValue = {
  user: User | null;
  initializing: boolean;
  profile: UserProfile | null;
  profileError: string | null;
  retryProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(Boolean(auth));
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  async function loadProfile(uid: string) {
    setProfileError(null);
    try {
      setProfile(await getUserProfile(uid));
    } catch {
      setProfileError("We couldn't load your information.");
    }
  }

  async function retryProfile() {
    if (!user) return;
    await loadProfile(user.uid);
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
      if (nextUser) await loadProfile(nextUser.uid);
      setInitializing(false);
    });
    return unsubscribe;
  }, []);

  return <AuthContext.Provider value={{ user, initializing, profile, profileError, retryProfile }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
