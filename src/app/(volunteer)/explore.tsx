import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { countActiveFilters, EMPTY_FILTERS, matchesFilters, RequestFilterModal, type RequestFilters } from '../../components/RequestFilterModal';
import { getOpenRequests } from '../../services/requestService';
import { colors } from '../../theme/colors';
import type { CompanionshipRequest } from '../../types/request';

function formatDuration(item: CompanionshipRequest): string | null {
  if (item.durationLabel) return item.durationLabel;
  if (item.durationMinutes) return item.durationMinutes >= 60 ? `${(item.durationMinutes / 60).toFixed(item.durationMinutes % 60 ? 1 : 0)} hour${item.durationMinutes === 60 ? '' : 's'}` : `${item.durationMinutes} min`;
  return null;
}

function filterChipLabels(filters: RequestFilters): { key: string; label: string; clear: (current: RequestFilters) => RequestFilters }[] {
  const chips: { key: string; label: string; clear: (current: RequestFilters) => RequestFilters }[] = [];
  filters.activityTypes.forEach((item) =>
    chips.push({ key: `activity-${item}`, label: item, clear: (current) => ({ ...current, activityTypes: current.activityTypes.filter((entry) => entry !== item) }) }),
  );
  if (filters.location.trim()) chips.push({ key: 'location', label: filters.location.trim(), clear: (current) => ({ ...current, location: '' }) });
  if (filters.dateFilter !== 'any') {
    const label = filters.dateFilter === 'today' ? 'Today' : filters.dateFilter === 'tomorrow' ? 'Tomorrow' : filters.dateFilter === 'week' ? 'This Week' : filters.customDate || 'Chosen date';
    chips.push({ key: 'date', label, clear: (current) => ({ ...current, dateFilter: 'any', customDate: '' }) });
  }
  if (filters.durationLabel) chips.push({ key: 'duration', label: filters.durationLabel, clear: (current) => ({ ...current, durationLabel: null }) });
  return chips;
}

export default function Explore() {
  const router = useRouter();
  const [items, setItems] = useState<CompanionshipRequest[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(false);
  const [filters, setFilters] = useState<RequestFilters>(EMPTY_FILTERS);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const load = useCallback(async () => { setLoading(true); setError(false); try { setItems(await getOpenRequests()); } catch { setError(true); } finally { setLoading(false); } }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const filteredItems = useMemo(() => items.filter((item) => matchesFilters(item, filters)), [items, filters]);
  const activeFilterCount = countActiveFilters(filters);
  const chips = useMemo(() => filterChipLabels(filters), [filters]);
  const noMatches = !loading && !error && items.length > 0 && filteredItems.length === 0;

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}><Text style={styles.title}>Available Requests</Text><Text style={styles.subtitle}>Find an opportunity that matches your time and interests.</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Filter requests${activeFilterCount ? `, ${activeFilterCount} active` : ''}`} style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]} onPress={() => setFilterModalOpen(true)}>
          <Text style={[styles.filterButtonText, activeFilterCount > 0 && styles.filterButtonTextActive]}>{activeFilterCount > 0 ? `Filter (${activeFilterCount})` : 'Filter'}</Text>
        </Pressable>
      </View>
      {chips.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {chips.map((chip) => (
            <Pressable key={chip.key} accessibilityRole="button" accessibilityLabel={`Remove filter ${chip.label}`} style={styles.activeChip} onPress={() => setFilters((current) => chip.clear(current))}>
              <Text style={styles.activeChipText}>{chip.label}  ×</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" accessibilityLabel="Clear all filters" style={styles.clearAllChip} onPress={() => setFilters(EMPTY_FILTERS)}>
            <Text style={styles.clearAllChipText}>Clear All</Text>
          </Pressable>
        </ScrollView>
      ) : null}
    </View>
    {loading ? <Center><ActivityIndicator size="large" color={colors.primary} /></Center>
      : error ? <Center><Text style={styles.emptyTitle}>We couldn&apos;t load available requests.</Text><Text style={styles.emptyText}>Please try again.</Text><Pressable accessibilityRole="button" style={styles.retry} onPress={() => void load()}><Text style={styles.retryText}>Try Again</Text></Pressable></Center>
      : noMatches ? <Center><Text style={styles.emptyTitle}>No matching requests</Text><Text style={styles.emptyText}>Try changing or clearing your filters.</Text><Pressable accessibilityRole="button" style={styles.retry} onPress={() => setFilters(EMPTY_FILTERS)}><Text style={styles.retryText}>Clear Filters</Text></Pressable></Center>
      : <ScrollView contentContainerStyle={styles.list}>{filteredItems.length ? filteredItems.map((item) => {
          const duration = formatDuration(item);
          return (
            <View key={item.id} style={styles.card}>
              <Text style={styles.cardTitle}>{item.activityType}</Text>
              <Text style={styles.meta}>{item.preferredDate.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })} • {item.preferredTime}</Text>
              {duration ? <Text style={styles.meta}>{duration}</Text> : null}
              <Text style={styles.meta}>{item.location}</Text>
              {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
              <Pressable accessibilityRole="button" accessibilityLabel={`View details for ${item.activityType} request`} style={styles.primary} onPress={() => router.push(`/(volunteer)/request-details/${item.id}`)}>
                <Text style={styles.primaryText}>View Details</Text>
              </Pressable>
            </View>
          );
        }) : <Center><Text style={styles.emptyTitle}>No requests available right now.</Text><Text style={styles.emptyText}>New opportunities will appear here when elderly users request help.</Text><Pressable accessibilityRole="button" style={styles.retry} onPress={() => void load()}><Text style={styles.retryText}>Refresh</Text></Pressable></Center>}</ScrollView>}
    <RequestFilterModal
      visible={filterModalOpen}
      filters={filters}
      onClose={() => setFilterModalOpen(false)}
      onApply={(next) => { setFilters(next); setFilterModalOpen(false); }}
    />
  </SafeAreaView>;
}

function Center({ children }: { children: React.ReactNode }) { return <View style={styles.center}>{children}</View>; }

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, header: { paddingHorizontal: 20, paddingTop: 14 }, headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }, headerCopy: { flex: 1 }, title: { color: colors.textPrimary, fontSize: 26, fontWeight: '800' }, subtitle: { color: colors.textSecondary, fontSize: 16, marginTop: 6 }, filterButton: { minHeight: 44, borderRadius: 13, borderWidth: 1, borderColor: colors.borderDark, backgroundColor: colors.surface, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }, filterButtonActive: { borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.primaryLight }, filterButtonText: { color: colors.textPrimary, fontSize: 15, fontWeight: '800' }, filterButtonTextActive: { color: colors.primaryDark }, chipRow: { flexDirection: 'row', gap: 8, paddingVertical: 12 }, activeChip: { minHeight: 40, borderRadius: 999, backgroundColor: colors.primaryLight, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' }, activeChipText: { color: colors.primaryDark, fontSize: 14, fontWeight: '700' }, clearAllChip: { minHeight: 40, borderRadius: 999, borderWidth: 1, borderColor: colors.borderDark, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' }, clearAllChipText: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' }, list: { padding: 20, paddingBottom: 35, gap: 12, flexGrow: 1 }, card: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 18, shadowColor: colors.shadow, shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 }, cardTitle: { color: colors.textPrimary, fontSize: 19, fontWeight: '800' }, meta: { color: colors.textSecondary, fontSize: 16, marginTop: 7 }, description: { color: colors.textPrimary, fontSize: 16, lineHeight: 23, marginTop: 9 }, primary: { minHeight: 52, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 15 }, primaryText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '800' }, center: { flex: 1, minHeight: 260, alignItems: 'center', justifyContent: 'center', padding: 24 }, emptyTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '800', textAlign: 'center' }, emptyText: { color: colors.textSecondary, fontSize: 16, lineHeight: 23, textAlign: 'center', marginTop: 8 }, retry: { minHeight: 52, borderRadius: 13, backgroundColor: colors.primary, paddingHorizontal: 20, justifyContent: 'center', marginTop: 16 }, retryText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '800' } });
