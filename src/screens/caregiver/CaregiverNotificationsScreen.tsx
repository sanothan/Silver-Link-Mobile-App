import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import {
  getAcceptedElderlyLinks,
  getCaregiverLinks,
} from "../../services/caregiverLinkService";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../services/notificationService";
import { getRequestsForLinkedElderlyUser } from "../../services/requestService";
import { colors } from "../../theme/colors";
import type { AppNotification } from "../../types/notification";
import { formatRelativeTime } from "../../utils/time";

function iconFor(type: AppNotification["type"]) {
  switch (type) {
    case "request_accepted":
      return "✓";
    case "request_scheduled":
      return "◷";
    case "request_rescheduled":
      return "◷";
    case "activity_reminder":
      return "⏰";
    case "request_started":
      return "▶";
    case "request_completed":
      return "★";
    case "request_cancelled":
      return "×";
    case "caregiver_link_request":
      return "C";
    case "caregiver_link_accepted":
      return "✓";
    case "caregiver_link_rejected":
      return "×";
    case "chat_message":
      return "💬";
    default:
      return "!";
  }
}

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

  const resolveElderlyUserIdForRequest = useCallback(async (requestId: string): Promise<string | null> => {
    if (!user) return null;
    try {
      const links = await getAcceptedElderlyLinks(user.uid);
      for (const link of links) {
        const requests = await getRequestsForLinkedElderlyUser(link.elderlyUserId).catch(() => []);
        if (requests.some((request) => request.id === requestId)) {
          return link.elderlyUserId;
        }
      }
      return null;
    } catch {
      return null;
    }
  }, [user]);

  const openNotification = useCallback(async (item: AppNotification) => {
    if (!item.read) {
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read: true } : entry));
      try {
        await markNotificationRead(item.id);
      } catch {
        // Keep local read state; a refresh will reconcile it.
      }
    }

    if (item.linkId) {
      const elderlyUserId = item.elderlyUserId ?? (await getAcceptedElderlyLinks(user?.uid ?? "").then((links) => links.find((link) => link.id === item.linkId)?.elderlyUserId ?? null).catch(() => null));
      if (elderlyUserId) {
        router.push({ pathname: "/caregiver-trusted-contact" as any, params: { elderlyUserId } });
      } else {
        router.push("/caregiver-profile" as any);
      }
      return;
    }

    if (!item.requestId) {
      router.push("/caregiver-profile" as any);
      return;
    }

    const elderlyUserId = item.elderlyUserId ?? (await resolveElderlyUserIdForRequest(item.requestId));
    if (!elderlyUserId) {
      Alert.alert("Unable to open notification", "This activity is no longer available to view.");
      return;
    }

    if (item.type === "chat_message") {
      router.push({ pathname: "/caregiver-volunteer-chat/[id]" as any, params: { id: item.requestId, elderlyUserId } });
      return;
    }

    router.push({ pathname: "/caregiver-request-details/[id]" as any, params: { id: item.requestId, elderlyUserId } });
  }, [resolveElderlyUserIdForRequest, router, user]);

  const markAll = useCallback(async () => {
    if (!user) return;
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    try {
      await markAllNotificationsRead(user.uid);
    } catch {
      void load();
    }
  }, [load, user]);

  const unreadCount = items.filter((item) => !item.read).length;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>Notifications</Text>
          {!loading && unreadCount > 0 ? <Text style={styles.unread}> {unreadCount} unread</Text> : null}
        </View>
        {unreadCount > 0 ? (
          <Pressable accessibilityRole="button" onPress={() => void markAll()}>
            <Text style={styles.markAll}>Mark all read</Text>
          </Pressable>
        ) : <View style={styles.markAllSpacer} />}
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.helper}>Loading notifications…</Text></View>
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
            <Pressable key={item.id} accessibilityRole="button" onPress={() => void openNotification(item)} style={[styles.card, !item.read && styles.cardUnread]}>
              <View style={styles.row}>
                <View style={styles.iconWrap}><Text style={styles.icon}>{iconFor(item.type)}</Text></View>
                <View style={styles.cardBody}>
                  <View style={styles.cardHead}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    {!item.read ? <View style={styles.dot} /> : null}
                  </View>
                  <Text style={styles.message}>{item.message}</Text>
                  <Text style={styles.time}>{formatRelativeTime(item.createdAt)}</Text>
                </View>
              </View>
            </Pressable>
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
  headerText: { flex: 1, alignItems: "center" },
  title: { color: colors.textPrimary, fontSize: 18, fontWeight: "800" },
  unread: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  markAll: { color: colors.primary, fontSize: 13, fontWeight: "800" },
  markAllSpacer: { width: 82 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  card: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 12 },
  cardUnread: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  row: { flexDirection: "row", alignItems: "flex-start" },
  iconWrap: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceSoft, alignItems: "center", justifyContent: "center", marginRight: 12 },
  icon: { color: colors.primary, fontSize: 15, fontWeight: "800" },
  cardBody: { flex: 1, gap: 6 },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: "800", flex: 1 },
  dot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: colors.primary, marginLeft: 8 },
  message: { color: colors.textSecondary, fontSize: 15, lineHeight: 21 },
  time: { color: colors.textMuted, fontSize: 13 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  heading: { color: colors.textPrimary, fontSize: 19, fontWeight: "800", textAlign: "center" },
  helper: { color: colors.textSecondary, fontSize: 15, lineHeight: 22, textAlign: "center" },
  button: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 22, paddingVertical: 13 },
  buttonText: { color: colors.textOnPrimary, fontSize: 15, fontWeight: "800" },
});
