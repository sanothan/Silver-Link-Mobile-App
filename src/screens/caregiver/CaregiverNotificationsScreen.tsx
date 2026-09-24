import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { getNotifications } from "../../services/notificationService";
import { colors } from "../../theme/colors";
import type { AppNotification } from "../../types/notification";
import { formatRelativeTime } from "../../utils/time";

export default function CaregiverNotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setError(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      setItems(await getNotifications(user.uid, 50));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Notifications</Text>
        <View style={styles.spacer} />
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.heading}>Notifications unavailable</Text>
          <Text style={styles.helper}>We couldn&apos;t load your notifications.</Text>
          <Pressable accessibilityRole="button" style={styles.button} onPress={() => void load()}>
            <Text style={styles.buttonText}>Try Again</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.heading}>No notifications yet</Text>
          <Text style={styles.helper}>Important connection and visit updates will appear here.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {items.map((item) => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.message}>{item.message}</Text>
              <Text style={styles.time}>{formatRelativeTime(item.createdAt)}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 58, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { color: colors.primary, fontSize: 16, fontWeight: "800" },
  title: { color: colors.textPrimary, fontSize: 18, fontWeight: "800" },
  spacer: { width: 44 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  card: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 6 },
  cardTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: "800" },
  message: { color: colors.textSecondary, fontSize: 15, lineHeight: 21 },
  time: { color: colors.textMuted, fontSize: 13 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  heading: { color: colors.textPrimary, fontSize: 19, fontWeight: "800", textAlign: "center" },
  helper: { color: colors.textSecondary, fontSize: 15, lineHeight: 22, textAlign: "center" },
  button: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 22, paddingVertical: 13 },
  buttonText: { color: colors.textOnPrimary, fontSize: 15, fontWeight: "800" },
});
