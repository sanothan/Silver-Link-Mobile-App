import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCurrentViewer } from '../services/currentUser';
import { ReportAccessError, isAdmin } from '../services/reportAccess';
import type { ReportViewer } from '../services/reportAccess';
import { getReportsForAdmin } from '../services/reportService';
import { colors } from '../theme/Colors';
import { REPORT_CATEGORY_LABEL, REPORT_STATUS_LABEL } from '../types/report';
import type { ReportRecord, ReportStatus } from '../types/report';
import { formatRelativeTime } from '../utils/time';

type LoadState = 'loading' | 'ready' | 'denied' | 'error';

const FILTERS: { value: ReportStatus | 'all'; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'under_review', label: 'Under review' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'all', label: 'All' },
];

export default function AdminReportsScreen() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>('loading');
  const [viewer, setViewer] = useState<ReportViewer | null>(null);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [filter, setFilter] = useState<ReportStatus | 'all'>('open');

  const load = useCallback(async (current: ReportViewer | null, status: ReportStatus | 'all') => {
    setState('loading');
    try {
      setReports(await getReportsForAdmin(current, status === 'all' ? undefined : status));
      setState('ready');
    } catch (error) {
      setState(error instanceof ReportAccessError ? 'denied' : 'error');
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const current = await getCurrentViewer();
      if (!active) return;
      setViewer(current);
      if (!isAdmin(current)) {
        setState('denied');
        return;
      }
      await load(current, filter);
    })();
    return () => {
      active = false;
    };
  }, [filter, load]);

  // Returning from the detail screen should show the status the administrator just saved.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      if (isAdmin(viewer)) void load(viewer, filter);
    }, [filter, load, viewer]),
  );

  if (state === 'denied') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.centerHeading}>Administrators only</Text>
          <Text style={styles.centerText}>
            Safety reports contain private information about the people who filed them, so only
            administrators can open this screen.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (state === 'loading') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerText}>Loading reports...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (state === 'error') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.centerHeading}>We could not load safety reports.</Text>
          <Pressable accessibilityRole="button" style={styles.retryButton} onPress={() => void load(viewer, filter)}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Safety reports</Text>
        <Text style={styles.subtitle}>Reports submitted by SilverLink members, newest first.</Text>

        <View style={styles.filterRow}>
          {FILTERS.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === option.value }}
              style={[styles.filterChip, filter === option.value && styles.filterChipActive]}
              onPress={() => setFilter(option.value)}
            >
              <Text style={[styles.filterText, filter === option.value && styles.filterTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {reports.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nothing to review</Text>
            <Text style={styles.emptyBody}>There are no reports matching this filter.</Text>
          </View>
        ) : (
          <View style={styles.cards}>
            {reports.map((report) => (
              <Pressable
                key={report.id}
                accessibilityRole="button"
                accessibilityLabel={`Review report: ${REPORT_CATEGORY_LABEL[report.category]}, ${REPORT_STATUS_LABEL[report.status]}`}
                style={[styles.card, report.urgent && styles.cardUrgent]}
                onPress={() => router.push({ pathname: '/admin-report-detail', params: { id: report.id } })}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle}>{REPORT_CATEGORY_LABEL[report.category]}</Text>
                  <View style={[styles.badge, report.urgent ? styles.badgeUrgent : styles.badgeNormal]}>
                    <Text style={[styles.badgeText, report.urgent ? styles.badgeTextUrgent : styles.badgeTextNormal]}>
                      {report.urgent ? 'High priority' : REPORT_STATUS_LABEL[report.status]}
                    </Text>
                  </View>
                </View>

                <Text style={styles.cardDetail}>
                  {formatRelativeTime(report.createdAt)} - {REPORT_STATUS_LABEL[report.status]}
                </Text>
                <Text style={styles.cardDetail}>
                  Reported by {report.reporterRole || 'member'} ({report.reporterId ?? 'identity withheld'})
                </Text>
                {report.subject.type === 'none' ? null : (
                  <Text style={styles.cardSubject}>
                    About {report.subject.type === 'user' ? 'member' : 'activity'}: {report.subject.label || report.subject.id}
                  </Text>
                )}

                <Text style={styles.message} numberOfLines={3}>
                  {report.description || 'No description provided.'}
                </Text>

                {report.adminNote ? (
                  <Text style={styles.noteLine} numberOfLines={2}>
                    Latest note: {report.adminNote}
                  </Text>
                ) : null}

                <Text style={styles.openLink}>Review and update &rsaquo;</Text>
              </Pressable>
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
  centerHeading: { color: colors.textPrimary, fontSize: 20, lineHeight: 27, fontWeight: '800', textAlign: 'center' },
  retryButton: {
    minHeight: 48,
    minWidth: 130,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  retryText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '800' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800', color: colors.textPrimary },
  subtitle: { fontSize: 15, lineHeight: 21, color: colors.textSecondary, marginTop: 4 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16, marginBottom: 18 },
  filterChip: {
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  filterChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  filterText: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
  filterTextActive: { color: colors.primary },
  cards: { gap: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 17 },
  cardUrgent: { borderColor: colors.error, backgroundColor: colors.errorLight },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardTitle: { flex: 1, color: colors.textPrimary, fontSize: 16, lineHeight: 22, fontWeight: '800' },
  cardDetail: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 6 },
  cardSubject: { color: colors.textPrimary, fontSize: 14, lineHeight: 20, fontWeight: '700', marginTop: 8 },
  message: { color: colors.textPrimary, fontSize: 14, lineHeight: 20, marginTop: 8 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeUrgent: { backgroundColor: colors.error },
  badgeNormal: { backgroundColor: colors.surfaceSoft },
  badgeText: { fontSize: 12, fontWeight: '800' },
  badgeTextUrgent: { color: colors.textOnPrimary },
  badgeTextNormal: { color: colors.textSecondary },
  noteLine: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 8, fontStyle: 'italic' },
  openLink: { color: colors.primary, fontSize: 14, lineHeight: 20, fontWeight: '800', marginTop: 12 },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    alignItems: 'center',
  },
  emptyTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '800' },
  emptyBody: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 6, textAlign: 'center' },
});
