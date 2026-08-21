import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

const PUBLIC_ROUTES = new Set(['index', 'welcome', 'login', 'register']);

function RootNavigator() {
  const { user, profile, initializing } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (initializing) return;
    const currentRoute = segments[segments.length - 1] ?? 'index';
    const inPublicRoute = PUBLIC_ROUTES.has(currentRoute);
    const inElderlyRoutes = (segments as readonly string[]).includes('(elderly)');

    if (!user && (currentRoute === 'home' || inElderlyRoutes)) {
      router.replace('/login');
    } else if (user && inPublicRoute) {
      router.replace(profile?.role === 'elderly' ? '/(elderly)' : '/home');
    } else if (user && profile?.role !== 'elderly' && inElderlyRoutes) {
      router.replace('/home');
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
      <Stack.Screen name="(elderly)" />
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
