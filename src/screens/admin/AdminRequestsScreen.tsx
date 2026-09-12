import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listRequests } from '../../services/adminDashboardService';
import { colors } from '../../theme/colors';
import type { AdminRequestRow } from '../../types/admin';
import { REQUEST_STATUS_LABELS, type RequestStatus } from '../../types/request';

type LoadState = 'loading' | 'ready' | 'error';
type StatusFilter = 'all' | RequestStatus;

const STATUS_FILTERS: StatusFilter[] = ['all', 'pending', 'accepted', 'scheduled', 'in_progress', 'completed', 'cancelled'];

function statusFilterLabel(filter: StatusFilter): string {
  return filter === 'all' ? 'All' : REQUEST_STATUS_LABELS[filter];
}

function statusBadgeStyle(status: string) {
  if (status === 'completed') return styles.statusBadgeSuccess;
  if (status === 'cancelled') return styles.statusBadgeError;
  if (status === 'pending') return styles.statusBadgeWarning;
  return undefined;
}

export default function AdminRequestsScreen() {
  const [state, setState] = useState<LoadState>('loading');
  const [requests, setRequests] = useState<AdminRequestRow[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const load = useCallback(async () => {
    setState('loading');
    try {
      const next = await listRequests();
      setRequests(next);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const filteredRequests = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    return requests.filter((request) => {
      if (statusFilter !== 'all' && request.status !== statusFilter) return false;
      if (!trimmed) return true;
      return (
        request.ownerName.toLowerCase().includes(trimmed) ||
        request.category.toLowerCase().includes(trimmed) ||
        (request.assignedVolunteerName?.toLowerCase().includes(trimmed) ?? false)
      );
    });
  }, [requests, query, statusFilter]);

  if (state === 'loading') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerText}>Loading requests…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (state === 'error') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.centerHeading}>We couldn&apos;t load the requests.</Text>
          <Text style={styles.centerText}>Please try again.</Text>
          <Pressable accessibilityRole="button" style={styles.retryButton} onPress={() => void load()}>
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Companionship Requests</Text>
        <Text style={styles.subtitle}>Monitor requests, owners, categories, and assigned volunteers.</Text>

        <TextInput
          style={styles.searchInput}
          placeholder="Search by owner, category, or volunteer"
          placeholderTextColor={colors.inputPlaceholder}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search requests"
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {STATUS_FILTERS.map((filter) => (
            <Pressable
              key={filter}
              accessibilityRole="button"
              accessibilityState={{ selected: statusFilter === filter }}
              style={[styles.filterChip, statusFilter === filter && styles.filterChipActive]}
              onPress={() => setStatusFilter(filter)}
            >
              <Text style={[styles.filterChipText, statusFilter === filter && styles.filterChipTextActive]}>
                {statusFilterLabel(filter)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.sectionTitle}>{filteredRequests.length} request{filteredRequests.length === 1 ? '' : 's'}</Text>

        {filteredRequests.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No requests found</Text>
            <Text style={styles.emptyBody}>Try a different search term or filter.</Text>
          </View>
        ) : (
          <View style={styles.requestCards}>
            {filteredRequests.map((request) => (
              <View key={request.id} style={styles.requestCard}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle}>{request.ownerName}</Text>
                  <View style={[styles.statusBadge, statusBadgeStyle(request.status)]}>
                    <Text style={styles.statusBadgeText}>
                      {REQUEST_STATUS_LABELS[request.status as RequestStatus] ?? request.status}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardDetail}>{request.category}</Text>
                <Text style={styles.cardVolunteer}>
                  {request.assignedVolunteerName ? `Volunteer: ${request.assignedVolunteerName}` : 'No volunteer assigned yet'}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  centerText: { color: colors.textSecondary, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  centerHeading: { color: colors.textPrimary, fontWeight: '800', fontSize: 20, lineHeight: 27, textAlign: 'center' },
  retryButton: { minHeight: 48, minWidth: 130, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  retryText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '800' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800', color: colors.textPrimary },
  subtitle: { fontSize: 15, lineHeight: 21, color: colors.textSecondary, marginTop: 4, marginBottom: 20 },
  searchInput: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, paddingHorizontal: 14, fontSize: 15, color: colors.textPrimary, marginBottom: 14 },
  filterRow: { gap: 8, paddingBottom: 4 },
  filterChip: { minHeight: 40, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
  filterChipTextActive: { color: colors.textOnPrimary },
  sectionTitle: { fontSize: 18, lineHeight: 24, fontWeight: '800', color: colors.textPrimary, marginTop: 20, marginBottom: 12 },
  requestCards: { gap: 10 },
  requestCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 15 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardTitle: { flex: 1, color: colors.textPrimary, fontSize: 16, lineHeight: 22, fontWeight: '800' },
  cardDetail: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 4 },
  cardVolunteer: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: 6 },
  statusBadge: { backgroundColor: colors.surfaceSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeSuccess: { backgroundColor: colors.successLight },
  statusBadgeError: { backgroundColor: colors.errorLight },
  statusBadgeWarning: { backgroundColor: colors.warningLight },
  statusBadgeText: { color: colors.textPrimary, fontSize: 12, fontWeight: '800' },
  emptyCard: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 20, alignItems: 'center' },
  emptyTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '800' },
  emptyBody: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 6, textAlign: 'center' },
});
