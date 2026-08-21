import { Stack, type Href, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import type { UserRole } from '../types/user';

const PUBLIC_ROUTES = new Set(['index', 'welcome', 'login', 'register']);

const ROLE_HOME: Record<UserRole, Href> = {
  elderly: '/(elderly)' as Href,
  volunteer: '/(volunteer)' as Href,
  caregiver: '/home' as Href,
  admin: '/admin' as Href,
};

const ROLE_ROUTE_GROUP: Record<UserRole, string> = {
  elderly: '(elderly)',
  volunteer: '(volunteer)',
  caregiver: 'home',
  admin: 'admin',
};

function RootNavigator() {
  const { user, profile, initializing } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (initializing) return;
    const currentRoute = segments[segments.length - 1] ?? 'index';
    const inPublicRoute = PUBLIC_ROUTES.has(currentRoute);
    const segmentList = segments as readonly string[];

    const protectedGroupEntered = (Object.keys(ROLE_ROUTE_GROUP) as UserRole[]).find((role) =>
      segmentList.includes(ROLE_ROUTE_GROUP[role])
    );

    if (!user && protectedGroupEntered) {
      router.replace('/login');
      return;
    }

    if (user && inPublicRoute) {
      const role = profile?.role;
      router.replace(role ? ROLE_HOME[role] : '/login');
      return;
    }

    if (user && protectedGroupEntered && profile?.role && protectedGroupEntered !== profile.role) {
      router.replace(ROLE_HOME[profile.role]);
    }
  }, [user, profile, initializing, segments, router]);

  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="home" />
      <Stack.Screen name="admin" />
      <Stack.Screen name="(elderly)" />
      <Stack.Screen name="(volunteer)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </AuthProvider>
  );
}
