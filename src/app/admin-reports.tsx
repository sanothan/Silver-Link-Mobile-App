import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCurrentViewer } from '../services/currentUser';
import { ReportAccessError, isAdmin } from '../services/reportAccess';
import type { ReportViewer } from '../services/reportAccess';
import { getReportsForAdmin, updateReportStatus } from '../services/reportService';
import { colors } from '../theme/Colors';
import { REPORT_CATEGORY_LABEL, REPORT_STATUS_LABEL } from '../types/report';
import type { ReportRecord, ReportStatus } from '../types/report';
import { formatRelativeTime } from '../utils/time';

type LoadState = 'loading' | 'ready' | 'denied' | 'error';

const FILTERS: { value: ReportStatus | 'all'; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'under_review', label: 'Under review' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All' },
];

export default function AdminReportsScreen() {
  const [state, setState] = useState<LoadState>('loading');
  const [viewer, setViewer] = useState<ReportViewer | null>(null);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [filter, setFilter] = useState<ReportStatus | 'all'>('open');
  const [workingId, setWorkingId] = useState<string | null>(null);

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

  const changeStatus = useCallback(
    async (report: ReportRecord, status: ReportStatus) => {
      setWorkingId(report.id);
      try {
        await updateReportStatus(viewer, report.id, status);
        setReports((current) =>
          filter === 'all'
            ? current.map((item) => (item.id === report.id ? { ...item, status } : item))
            : current.filter((item) => item.id !== report.id),
        );
      } catch {
        Alert.alert('Action failed', 'Could not update this report. Please try again.');
      } finally {
        setWorkingId(null);
      }
    },
    [filter, viewer],
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
              <View key={report.id} style={[styles.card, report.urgent && styles.cardUrgent]}>
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

                <Text style={styles.message}>{report.description || 'No description provided.'}</Text>

                <View style={styles.actionRow}>
                  {report.status !== 'under_review' && report.status !== 'resolved' ? (
                    <Pressable
                      accessibilityRole="button"
                      style={[styles.secondaryButton, workingId === report.id && styles.buttonDisabled]}
                      onPress={() => void changeStatus(report, 'under_review')}
                      disabled={workingId === report.id}
                    >
                      <Text style={styles.secondaryButtonText}>Start review</Text>
                    </Pressable>
                  ) : null}
                  {report.status !== 'resolved' ? (
                    <Pressable
                      accessibilityRole="button"
                      style={[styles.primaryButton, workingId === report.id && styles.buttonDisabled]}
                      onPress={() => void changeStatus(report, 'resolved')}
                      disabled={workingId === report.id}
                    >
                      <Text style={styles.primaryButtonText}>
                        {workingId === report.id ? 'Saving...' : 'Mark resolved'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
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
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  primaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: colors.textOnPrimary, fontSize: 14, fontWeight: '800' },
  secondaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  buttonDisabled: { opacity: 0.6 },
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
