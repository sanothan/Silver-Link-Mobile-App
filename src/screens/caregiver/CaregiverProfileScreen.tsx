import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { logoutUser } from "../../services/authService";
import { getAcceptedElderlyLinks } from "../../services/caregiverLinkService";
import { updateUserProfile } from "../../services/userService";
import { colors } from "../../theme/colors";

export default function CaregiverProfileScreen() {
  const router = useRouter();
  const { user, profile, retryProfile } = useAuth();
  const [elderlyUserId, setElderlyUserId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState(profile?.fullName ?? user?.displayName ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [locality, setLocality] = useState(profile?.locality ?? "");
  const [preferredLanguage, setPreferredLanguage] = useState(profile?.preferredLanguage ?? "");

  useEffect(() => {
    setFullName(profile?.fullName ?? user?.displayName ?? "");
    setPhone(profile?.phone ?? "");
    setLocality(profile?.locality ?? "");
    setPreferredLanguage(profile?.preferredLanguage ?? "");
  }, [profile, user]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      void getAcceptedElderlyLinks(user.uid)
        .then((links) => setElderlyUserId(links[0]?.elderlyUserId ?? null))
        .catch(() => setElderlyUserId(null));
    }, [user]),
  );

  const displayName = profile?.fullName || user?.displayName || "Caregiver";

  const save = async () => {
    if (!user || !fullName.trim()) {
      Alert.alert("Check your name", "Please enter your full name.");
      return;
    }
    setSaving(true);
    try {
      await updateUserProfile(user.uid, {
        fullName: fullName.trim(),
        phone: phone.trim(),
        locality: locality.trim(),
        preferredLanguage: preferredLanguage.trim(),
      });
      await retryProfile();
      setEditing(false);
      Alert.alert("Profile updated", "Your information has been saved.");
    } catch {
      Alert.alert("We couldn't update your profile", "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Profile</Text>
        <View style={styles.spacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.avatar}><Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text></View>
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.email}>{profile?.email || user?.email || ""}</Text>

        {!editing ? (
          <>
            <View style={styles.card}>
              <Text style={styles.label}>ROLE</Text>
              <Text style={styles.value}>Caregiver</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>PHONE</Text>
              <Text style={styles.value}>{profile?.phone || "Not added"}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>LOCALITY</Text>
              <Text style={styles.value}>{profile?.locality || "Not added"}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>PREFERRED LANGUAGE</Text>
              <Text style={styles.value}>{profile?.preferredLanguage || "Not added"}</Text>
            </View>
            <Pressable accessibilityRole="button" style={styles.button} onPress={() => setEditing(true)}>
              <Text style={styles.buttonText}>Edit Profile</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Edit Profile</Text>
            <Field label="Full name" value={fullName} onChangeText={setFullName} />
            <Field label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <Field label="Locality" value={locality} onChangeText={setLocality} />
            <Field label="Preferred language" value={preferredLanguage} onChangeText={setPreferredLanguage} />
            <Pressable accessibilityRole="button" disabled={saving} style={styles.button} onPress={() => void save()}>
              <Text style={styles.buttonText}>{saving ? "Saving..." : "Save Profile"}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={() => setEditing(false)}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
          </View>
        )}

        {elderlyUserId ? (
          <Pressable accessibilityRole="button" style={styles.button} onPress={() => router.push({ pathname: "/caregiver-trusted-contact" as any, params: { elderlyUserId } })}>
            <Text style={styles.buttonText}>Trusted Contact</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" style={styles.signOut} onPress={() => void logoutUser()}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChangeText, keyboardType = "default" }: { label: string; value: string; onChangeText: (value: string) => void; keyboardType?: "default" | "phone-pad" | "email-address"; }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        style={styles.input}
        placeholderTextColor={colors.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 58, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { color: colors.primary, fontSize: 16, fontWeight: "800" },
  title: { color: colors.textPrimary, fontSize: 18, fontWeight: "800" },
  spacer: { width: 44 },
  content: { padding: 24, gap: 12, paddingBottom: 40 },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginTop: 18, alignSelf: "center" },
  avatarText: { color: colors.primary, fontSize: 32, fontWeight: "800" },
  name: { color: colors.textPrimary, fontSize: 24, fontWeight: "800", marginTop: 6, textAlign: "center" },
  email: { color: colors.textSecondary, fontSize: 15, textAlign: "center" },
  card: { alignSelf: "stretch", backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: "800", letterSpacing: 0.8 },
  value: { color: colors.textPrimary, fontSize: 16, fontWeight: "700", marginTop: 6 },
  button: { alignSelf: "stretch", backgroundColor: colors.primary, borderRadius: 12, minHeight: 50, alignItems: "center", justifyContent: "center", marginTop: 8 },
  buttonText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: "800" },
  signOut: { alignSelf: "stretch", borderWidth: 1, borderColor: colors.error, borderRadius: 12, minHeight: 50, alignItems: "center", justifyContent: "center", marginTop: 6 },
  signOutText: { color: colors.error, fontSize: 16, fontWeight: "800" },
  formCard: { alignSelf: "stretch", backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 14 },
  sectionTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "800" },
  fieldWrap: { gap: 6 },
  fieldLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: "700" },
  input: { minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, color: colors.textPrimary, backgroundColor: colors.background },
  secondaryButton: { alignSelf: "stretch", borderWidth: 1, borderColor: colors.border, borderRadius: 12, minHeight: 48, alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { color: colors.primary, fontSize: 16, fontWeight: "800" },
});
