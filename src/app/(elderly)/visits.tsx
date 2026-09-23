import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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
import { getElderlyRequests } from '../../services/requestService';
import { colors } from '../../theme/colors';
import {
  REQUEST_STATUS_LABELS,
  type CompanionshipRequest,
} from '../../types/request';

type Filter = 'active' | 'completed' | 'cancelled';

const FILTER_LABELS: Record<Filter, string> = {
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function statusStyle(status: string): { bg: string; text: string } {
  switch (status) {
    case 'pending': return { bg: colors.warningLight, text: '#92400E' };
    case 'accepted': return { bg: colors.infoLight, text: '#075985' };
    case 'scheduled': return { bg: '#EDE9FE', text: '#5B21B6' };
    case 'in_progress': return { bg: '#DCFCE7', text: '#166534' };
    case 'completed': return { bg: colors.successLight, text: '#166534' };
    case 'cancelled': return { bg: colors.errorLight, text: '#991B1B' };
    default: return { bg: colors.surfaceSoft, text: colors.textSecondary };
  }
}

export default function MyRequests() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<CompanionshipRequest[]>([]);
  const [filter, setFilter] = useState<Filter>('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(false);
    try {
      setItems(await getElderlyRequests(user.uid));
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

  const filtered = useMemo(
    () =>
      items.filter((item) =>
        filter === 'active'
          ? !['completed', 'cancelled'].includes(item.status)
          : item.status === filter,
      ),
    [filter, items],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Requests</Text>
        <Pressable
          accessibilityRole="button"
          style={styles.newButton}
          onPress={() => router.push('/(elderly)/request')}
        >
          <Text style={styles.newText}>+ New</Text>
        </Pressable>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(['active', 'completed', 'cancelled'] as Filter[]).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === value }}
            onPress={() => setFilter(value)}
            style={[styles.filterTab, filter === value && styles.filterTabActive]}
          >
            <Text
              style={[
                styles.filterText,
                filter === value && styles.filterTextActive,
              ]}
            >
              {FILTER_LABELS[value]}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      {loading ? (
        <Center>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.emptyText}>Loading…</Text>
        </Center>
      ) : error ? (
        <Center>
          <Text style={styles.emptyTitle}>
            We couldn&apos;t load your requests.
          </Text>
          <Pressable style={styles.retryButton} onPress={() => void load()}>
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </Center>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {filtered.length ? (
            filtered.map((item) => {
              const sc = statusStyle(item.status);
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  style={styles.card}
                  onPress={() =>
                    router.push(`/(elderly)/request-details/${item.id}` as Href)
                  }
                >
                  {/* Activity name */}
                  <Text style={styles.cardTitle}>{item.activityType}</Text>

                  {/* Date/time */}
                  <Text style={styles.meta}>
                    {item.preferredDate.toLocaleDateString()} •{' '}
                    {item.preferredTime}
                  </Text>

                  {/* Status chip */}
                  <View style={[styles.statusChip, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.statusChipText, { color: sc.text }]}>
                      {REQUEST_STATUS_LABELS[item.status]}
                    </Text>
                  </View>

                  {/* Volunteer */}
                  {item.volunteerName ? (
                    <View style={styles.volunteerRow}>
                      <View style={styles.volunteerDot} />
                      <Text style={styles.volunteer}>
                        {item.volunteerName}
                        {item.volunteerVerified ? '  ✓' : ''}
                      </Text>
                    </View>
                  ) : null}

                  {/* Link */}
                  <Text style={styles.link}>View Details →</Text>
                </Pressable>
              );
            })
          ) : (
            <Center>
              <View style={styles.emptyIcon}>
                <Text style={styles.emptyIconText}>
                  {filter === 'completed' ? '✓' : filter === 'cancelled' ? '×' : '♡'}
                </Text>
              </View>
              <Text style={styles.emptyTitle}>No {filter} requests</Text>
              <Text style={styles.emptyText}>
                {filter === 'active'
                  ? 'Need companionship or help?'
                  : `Your ${filter} requests will appear here.`}
              </Text>
              {filter === 'active' ? (
                <Pressable
                  style={styles.retryButton}
                  onPress={() => router.push('/(elderly)/request')}
                >
                  <Text style={styles.retryText}>Request Help</Text>
                </Pressable>
              ) : null}
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: colors.textPrimary, fontSize: 28, fontWeight: '800', letterSpacing: -0.4 },
  newButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    shadowColor: '#3730A3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 3,
  },
  newText: { color: colors.textOnPrimary, fontSize: 15, fontWeight: '800' },

  /* Filters */
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 8,
  },
  filterTab: {
    flex: 1,
    minHeight: 44,
    borderRadius: 13,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterTabActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
    borderWidth: 2,
  },
  filterText: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
  filterTextActive: { color: colors.primaryDark, fontWeight: '800' },

  /* List */
  list: { paddingHorizontal: 20, paddingBottom: 40, gap: 12, flexGrow: 1 },

  /* Card */
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 8,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '800' },
  meta: { color: colors.textSecondary, fontSize: 15 },

  /* Status chip */
  statusChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  statusChipText: { fontSize: 13, fontWeight: '800' },

  /* Volunteer */
  volunteerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  volunteerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  volunteer: { color: colors.success, fontSize: 14, fontWeight: '700' },

  /* Link */
  link: { color: colors.primary, fontSize: 15, fontWeight: '800', marginTop: 4 },

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
  emptyIconText: { fontSize: 34, color: colors.primary },
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
