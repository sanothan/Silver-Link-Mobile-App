import { useMemo } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { logoutUser } from "../../services/authService";
import { colors } from "../../theme/colors";

type AdminAction = { id: string; title: string; description: string; icon: string };

const ADMIN_ACTIONS: AdminAction[] = [
  { id: "users", title: "Manage Users", description: "Review and moderate elderly, volunteer, and caregiver accounts.", icon: "👥" },
  { id: "volunteers", title: "Volunteer Approvals", description: "Verify pending volunteer applications.", icon: "✅" },
  { id: "reports", title: "Reports & Concerns", description: "Review flagged visits and safety reports.", icon: "⚠" },
  { id: "settings", title: "Platform Settings", description: "Configure app-wide options.", icon: "⚙" },
];

export default function AdminDashboardScreen() {
  const { user } = useAuth();

  const adminName = useMemo(() => {
    const displayName = user?.displayName?.trim();
    return displayName ? displayName.split(/\s+/)[0] : "Admin";
  }, [user?.displayName]);

  const handlePlaceholderAction = (title: string) => {
    Alert.alert(title, "This feature is coming soon for the admin dashboard.");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.greeting}>Welcome, {adminName}</Text>
            <Text style={styles.subtitle}>Platform administration overview.</Text>
          </View>
          <Pressable accessibilityRole="button" style={styles.logoutButton} onPress={() => logoutUser()}>
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        </View>

        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Admin Tools</Text>
          <View style={styles.actionGrid}>
            {ADMIN_ACTIONS.map((action) => (
              <Pressable
                key={action.id}
                accessibilityRole="button"
                style={styles.actionCard}
                onPress={() => handlePlaceholderAction(action.title)}
              >
                <Text style={styles.actionIcon}>{action.icon}</Text>
                <Text style={styles.actionTitle}>{action.title}</Text>
                <Text style={styles.actionDescription}>{action.description}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 },
  headerTextWrap: { flex: 1, paddingRight: 12 },
  greeting: { fontSize: 26, lineHeight: 32, fontWeight: "800", color: colors.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 15, lineHeight: 22, color: colors.textSecondary },
  logoutButton: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoutText: { color: colors.admin, fontWeight: "700", fontSize: 14 },
  sectionWrap: { marginBottom: 20 },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: colors.textPrimary, marginBottom: 12 },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12 },
  actionCard: {
    width: "48%",
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    minHeight: 140,
    shadowColor: colors.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  actionIcon: { fontSize: 26, marginBottom: 10 },
  actionTitle: { fontSize: 15, fontWeight: "700", color: colors.textPrimary, marginBottom: 6 },
  actionDescription: { fontSize: 12, lineHeight: 17, color: colors.textSecondary },
});
