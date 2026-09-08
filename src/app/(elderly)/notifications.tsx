import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from '../../services/notificationService';
import { colors } from '../../theme/colors';
import { formatRelativeTime } from '../../utils/time';
import type { AppNotification } from '../../types/notification';

function iconFor(type: AppNotification['type']) {
  switch (type) {
    case 'request_accepted': return '✓';
    case 'request_scheduled': return '◷';
    case 'request_started': return '▶';
    case 'request_completed': return '★';
    case 'request_cancelled': return '×';
    default: return '!';
  }
}

function iconBg(type: AppNotification['type']): string {
  switch (type) {
    case 'request_accepted': return '#E0E7FF';
    case 'request_scheduled': return colors.infoLight;
    case 'request_started': return colors.warningLight;
    case 'request_completed': return colors.successLight;
    case 'request_cancelled': return colors.errorLight;
    default: return colors.surfaceSoft;
  }
}

function iconColor(type: AppNotification['type']): string {
  switch (type) {
    case 'request_accepted': return colors.primary;
    case 'request_scheduled': return colors.info;
    case 'request_started': return colors.warning;
    case 'request_completed': return colors.success;
    case 'request_cancelled': return colors.error;
    default: return colors.textSecondary;
  }
}

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
        /* badge stays until next load */
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
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Alerts</Text>
          {!loading && items.length > 0 ? (
            <Text style={styles.subtitle}>
              {items.filter((i) => !i.read).length} unread
            </Text>
          ) : null}
        </View>
        {hasUnread && !loading ? (
          <Pressable
            accessibilityRole="button"
            style={styles.markAllButton}
            onPress={() => void markAll()}
          >
            <Text style={styles.markAllText}>Mark all read</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Content */}
      {loading ? (
        <Center>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.emptyText}>Loading alerts…</Text>
        </Center>
      ) : error ? (
        <Center>
          <Text style={styles.emptyTitle}>
            We couldn&apos;t load your notifications.
          </Text>
          <Pressable style={styles.retryButton} onPress={() => void load()}>
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
                accessibilityLabel={`${item.read ? 'Read' : 'Unread'} alert. ${item.title}. ${item.message}`}
                style={[styles.card, !item.read && styles.cardUnread]}
                onPress={() => void open(item)}
              >
                {/* Left accent for unread */}
                {!item.read && <View style={styles.cardAccent} />}

                <View style={styles.cardInner}>
                  {/* Icon */}
                  <View
                    style={[
                      styles.iconBox,
                      { backgroundColor: iconBg(item.type) },
                    ]}
                  >
                    <Text
                      style={[
                        styles.iconText,
                        { color: iconColor(item.type) },
                      ]}
                    >
                      {iconFor(item.type)}
                    </Text>
                  </View>

                  {/* Content */}
                  <View style={styles.cardContent}>
                    <View style={styles.cardHead}>
                      <Text style={styles.cardTitle}>{item.title}</Text>
                      {!item.read ? <View style={styles.unreadDot} /> : null}
                    </View>
                    <Text style={styles.message}>{item.message}</Text>
                    {item.volunteerName ? (
                      <Text style={styles.volunteerName}>
                        {item.volunteerName}
                        {item.volunteerVerified ? '  ✓ Verified' : ''}
                      </Text>
                    ) : null}
                    <View style={styles.cardFooter}>
                      <Text style={styles.time}>
                        {formatRelativeTime(item.createdAt)}
                      </Text>
                      {item.requestId ? (
                        <Text style={styles.link}>View Request →</Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              </Pressable>
            ))
          ) : (
            <Center>
              <View style={styles.emptyIcon}>
                <Text style={styles.emptyIconText}>✉</Text>
              </View>
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptyText}>
                Important updates will appear here.
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  /* Header */
  header: {
    minHeight: 70,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  markAllButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingLeft: 12,
    paddingRight: 4,
  },
  markAllText: { color: colors.primary, fontSize: 15, fontWeight: '800' },

  /* List */
  list: { padding: 20, paddingBottom: 40, gap: 10, flexGrow: 1 },

  /* Card */
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardUnread: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  cardAccent: {
    width: 4,
    backgroundColor: colors.primary,
  },
  cardInner: {
    flex: 1,
    flexDirection: 'row',
    padding: 16,
    gap: 14,
    alignItems: 'flex-start',
  },
  cardContent: { flex: 1, gap: 4 },

  /* Icon */
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconText: {
    fontSize: 20,
    fontWeight: '900',
  },

  /* Card internals */
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  message: {
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
  },
  volunteerName: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  time: { color: colors.textMuted, fontSize: 13 },
  link: { color: colors.primary, fontSize: 14, fontWeight: '800' },

  /* Center / Empty */
  center: {
    flex: 1,
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 12,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyIconText: { fontSize: 30, color: colors.primary },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyText: { color: colors.textSecondary, fontSize: 15, textAlign: 'center' },
  retryButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    justifyContent: 'center',
    shadowColor: '#3730A3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 3,
  },
  retryText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '800' },
});
