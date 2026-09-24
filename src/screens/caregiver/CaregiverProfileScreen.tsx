import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { logoutUser } from "../../services/authService";
import { getAcceptedElderlyLinks } from "../../services/caregiverLinkService";
import { colors } from "../../theme/colors";

export default function CaregiverProfileScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [elderlyUserId, setElderlyUserId] = useState<string | null>(null);
  const displayName = profile?.fullName || user?.displayName || "Caregiver";

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      void getAcceptedElderlyLinks(user.uid)
        .then((links) => setElderlyUserId(links[0]?.elderlyUserId ?? null))
        .catch(() => setElderlyUserId(null));
    }, [user]),
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Profile</Text>
        <View style={styles.spacer} />
      </View>
      <View style={styles.content}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text></View>
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.email}>{profile?.email || user?.email || ""}</Text>
        <View style={styles.card}>
          <Text style={styles.label}>ROLE</Text>
          <Text style={styles.value}>Caregiver</Text>
        </View>
        {elderlyUserId ? (
          <Pressable accessibilityRole="button" style={styles.button} onPress={() => router.push({ pathname: "/caregiver-trusted-contact" as any, params: { elderlyUserId } })}>
            <Text style={styles.buttonText}>Trusted Contact</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" style={styles.signOut} onPress={() => void logoutUser()}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 58, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { color: colors.primary, fontSize: 16, fontWeight: "800" },
  title: { color: colors.textPrimary, fontSize: 18, fontWeight: "800" },
  spacer: { width: 44 },
  content: { flex: 1, alignItems: "center", padding: 24, gap: 10 },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginTop: 18 },
  avatarText: { color: colors.primary, fontSize: 32, fontWeight: "800" },
  name: { color: colors.textPrimary, fontSize: 24, fontWeight: "800", marginTop: 6 },
  email: { color: colors.textSecondary, fontSize: 15 },
  card: { alignSelf: "stretch", backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16, marginTop: 18 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: "800", letterSpacing: 0.8 },
  value: { color: colors.textPrimary, fontSize: 16, fontWeight: "700", marginTop: 6 },
  button: { alignSelf: "stretch", backgroundColor: colors.primary, borderRadius: 12, minHeight: 50, alignItems: "center", justifyContent: "center", marginTop: 8 },
  buttonText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: "800" },
  signOut: { alignSelf: "stretch", borderWidth: 1, borderColor: colors.error, borderRadius: 12, minHeight: 50, alignItems: "center", justifyContent: "center", marginTop: 4 },
  signOutText: { color: colors.error, fontSize: 16, fontWeight: "800" },
});
