import { type Href, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from "../../services/notificationService";
import { colors } from "../../theme/colors";
import { formatRelativeTime } from "../../utils/time";
import type { AppNotification } from "../../types/notification";

export default function Notifications() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(false);
    try {
      setItems(await getNotifications(user.uid));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [user]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  useEffect(() => {
    if (!user) return;
    return subscribeToNotifications(
      user.uid,
      (nextItems) => {
        setItems(nextItems);
        setLoading(false);
        setError(false);
      },
      () => {
        setLoading(false);
        setError(true);
      },
    );
  }, [user]);

  const open = async (item: AppNotification) => {
    if (!item.read) {
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, read: true } : entry,
        ),
      );
      try {
        await markNotificationRead(item.id);
      } catch {
        /* the badge simply stays until the next load */
      }
    }
    if (item.requestId)
      router.push(`/(elderly)/request-details/${item.requestId}` as Href);
  };
  const markAll = async () => {
    if (!user) return;
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    try {
      await markAllNotificationsRead(user.uid);
    } catch {
      void load();
    }
  };
  const hasUnread = items.some((item) => !item.read);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Alerts</Text>
        {hasUnread && !loading ? (
          <Pressable
            accessibilityRole="button"
            style={styles.markAll}
            onPress={() => void markAll()}
          >
            <Text style={styles.markAllText}>Mark all as read</Text>
          </Pressable>
        ) : null}
      </View>
      {loading ? (
        <Center>
          <ActivityIndicator size="large" color={colors.primary} />
        </Center>
      ) : error ? (
        <Center>
          <Text style={styles.emptyTitle}>
            We couldn&apos;t load your notifications.
          </Text>
          <Pressable
            accessibilityRole="button"
            style={styles.retry}
            onPress={() => void load()}
          >
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </Center>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {items.length ? (
            items.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`${item.read ? "Read" : "Unread"} alert. ${item.title}. ${item.message}`}
                style={[styles.card, !item.read && styles.cardUnread]}
                onPress={() => void open(item)}
              >
                <View style={styles.cardHead}>
                  <View style={[styles.icon, iconStyle(item.type)]}>
                    <Text style={styles.iconText}>{iconFor(item.type)}</Text>
                  </View>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  {!item.read ? (
                    <>
                      <View style={styles.dot} />
                      <Text style={styles.unreadText}>Unread</Text>
                    </>
                  ) : null}
                </View>
                <Text style={styles.message}>{item.message}</Text>
                {item.volunteerName ? (
                  <Text style={styles.volunteer}>
                    {item.volunteerName}
                    {item.volunteerVerified ? "  ✓ Verified" : ""}
                  </Text>
                ) : null}
                <Text style={styles.time}>
                  {formatRelativeTime(item.createdAt)}
                </Text>
                {item.requestId ? (
                  <Text style={styles.link}>View Request →</Text>
                ) : null}
              </Pressable>
            ))
          ) : (
            <Center>
              <Text style={styles.emptyTitle}>No updates yet.</Text>
              <Text style={styles.emptyText}>
                Important request updates will appear here.
              </Text>
            </Center>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <View style={styles.center}>{children}</View>;
}
function iconFor(type: AppNotification["type"]) {
  return type === "request_accepted"
    ? "V"
    : type === "request_scheduled"
      ? "◷"
      : type === "request_started"
        ? "▶"
        : type === "request_completed"
          ? "✓"
          : "×";
}
function iconStyle(type: AppNotification["type"]) {
  return type === "request_scheduled"
    ? styles.iconScheduled
    : type === "request_started"
      ? styles.iconStarted
      : type === "request_completed"
        ? styles.iconCompleted
        : type === "request_cancelled"
          ? styles.iconCancelled
          : styles.iconAccepted;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    minHeight: 66,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { color: colors.textPrimary, fontSize: 28, fontWeight: "800" },
  markAll: { minHeight: 48, justifyContent: "center", paddingLeft: 14 },
  markAllText: { color: colors.primary, fontSize: 16, fontWeight: "800" },
  list: { padding: 20, paddingBottom: 35, gap: 12, flexGrow: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    minHeight: 150,
  },
  cardUnread: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 9 },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: { color: colors.textPrimary, fontSize: 19, fontWeight: "900" },
  iconAccepted: { backgroundColor: "#E0E7FF" },
  iconScheduled: { backgroundColor: colors.infoLight },
  iconStarted: { backgroundColor: colors.warningLight },
  iconCompleted: { backgroundColor: colors.successLight },
  iconCancelled: { backgroundColor: colors.errorLight },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  unreadText: { color: colors.primaryDark, fontSize: 13, fontWeight: "900" },
  cardTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 19,
    fontWeight: "800",
  },
  message: {
    color: colors.textPrimary,
    fontSize: 17,
    lineHeight: 24,
    marginTop: 9,
  },
  volunteer: {
    color: colors.success,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 9,
  },
  time: { color: colors.textSecondary, fontSize: 15, marginTop: 9 },
  link: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 13,
  },
  center: {
    flex: 1,
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 23,
    textAlign: "center",
    marginTop: 8,
  },
  retry: {
    minHeight: 52,
    borderRadius: 13,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    justifyContent: "center",
    marginTop: 16,
  },
  retryText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: "800" },
});
