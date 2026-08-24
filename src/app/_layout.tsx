import { Stack, useRouter, useSegments, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { AuthProvider, useAuth } from "../context/AuthContext";
import {
    canEnterDashboard,
    ROLE_HOME,
    roleForProtectedSegments,
} from "../services/accessControl";
import { colors } from "../theme/colors";
const PUBLIC_ROUTES = new Set(["index", "welcome", "login", "register"]);
const ACCOUNT_STATUS_ROUTE = "account-status";

function RootNavigator() {
  const { user, profile, profileError, initializing } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (initializing) return;
    const currentRoute = segments[segments.length - 1] ?? "index";
    const inPublicRoute = PUBLIC_ROUTES.has(currentRoute);
    const segmentList = segments as readonly string[];

    const protectedRole = roleForProtectedSegments(segmentList);
    const inAccountStatus = segmentList.includes(ACCOUNT_STATUS_ROUTE);

    if (!user && (protectedRole || inAccountStatus)) {
      router.replace("/welcome");
      return;
    }

    if (user && (!profile || profileError || !canEnterDashboard(profile))) {
      if (!inAccountStatus) router.replace("/account-status" as Href);
      return;
    }

    if (user && profile && inAccountStatus && canEnterDashboard(profile)) {
      router.replace(ROLE_HOME[profile.role]);
      return;
    }

    if (user && profile && inPublicRoute) {
      router.replace(ROLE_HOME[profile.role]);
      return;
    }

    if (user && profile && protectedRole && protectedRole !== profile.role) {
      router.replace(ROLE_HOME[profile.role]);
    }
  }, [user, profile, profileError, initializing, segments, router]);

  if (initializing) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surface,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen
        name="register"
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen name="account-status" />
      <Stack.Screen name="home" />
      <Stack.Screen
        name="link-elderly"
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="caregiver-elderly-requests"
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="caregiver-request-details/[id]"
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen name="(elderly)" />
      <Stack.Screen name="(volunteer)" />
      <Stack.Screen name="(admin)" />
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
