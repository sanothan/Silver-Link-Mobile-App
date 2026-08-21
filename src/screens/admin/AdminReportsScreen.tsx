import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getOpenReports, resolveReport } from '../../services/reportService';
import { colors } from '../../theme/colors';
import type { ReportRecord } from '../../types/report';
import { formatRelativeTime } from '../../utils/time';

type LoadState = 'loading' | 'ready' | 'error';

const CATEGORY_LABEL: Record<ReportRecord['category'], string> = { safety: 'Safety Report', complaint: 'User Complaint' };

export default function AdminReportsScreen() {
  const [state, setState] = useState<LoadState>('loading');
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      setReports(await getOpenReports());
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const handleResolve = useCallback(async (report: ReportRecord) => {
    setWorkingId(report.id);
    try {
      await resolveReport(report.id);
      setReports((current) => current.filter((item) => item.id !== report.id));
    } catch {
      Alert.alert('Action failed', 'Could not resolve this report. Please try again.');
    } finally {
      setWorkingId(null);
    }
  }, []);

  if (state === 'loading') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerText}>Loading reports…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (state === 'error') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.centerHeading}>We couldn't load the admin dashboard.</Text>
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
        <Text style={styles.title}>Open Reports</Text>
        <Text style={styles.subtitle}>Safety reports and complaints awaiting resolution.</Text>

        {reports.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No reports</Text>
            <Text style={styles.emptyBody}>There are currently no unresolved safety reports or complaints.</Text>
          </View>
        ) : (
          <View style={styles.cards}>
            {reports.map((report) => (
              <View key={report.id} style={[styles.card, report.urgent && styles.cardUrgent]}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle}>{CATEGORY_LABEL[report.category]}</Text>
                  <View style={[styles.priorityBadge, report.urgent ? styles.priorityHigh : styles.priorityNormal]}>
                    <Text style={[styles.priorityText, report.urgent ? styles.priorityHighText : styles.priorityNormalText]}>
                      {report.urgent ? 'High Priority' : 'Normal'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardDetail}>Reported {formatRelativeTime(report.createdAt)} · {report.createdByRole || 'user'}</Text>
                <Text style={styles.message} numberOfLines={4}>{report.message || 'No additional details provided.'}</Text>
                <Pressable
                  accessibilityRole="button"
                  style={[styles.resolveButton, workingId === report.id && styles.resolveButtonDisabled]}
                  onPress={() => void handleResolve(report)}
                  disabled={workingId === report.id}
                >
                  <Text style={styles.resolveButtonText}>{workingId === report.id ? 'Resolving…' : 'Mark Resolved'}</Text>
                </Pressable>
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
  cards: { gap: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 17 },
  cardUrgent: { borderColor: colors.error, backgroundColor: colors.errorLight },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardTitle: { flex: 1, color: colors.textPrimary, fontSize: 16, lineHeight: 22, fontWeight: '800' },
  cardDetail: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 6 },
  message: { color: colors.textPrimary, fontSize: 14, lineHeight: 20, marginTop: 8 },
  priorityBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  priorityHigh: { backgroundColor: colors.error },
  priorityNormal: { backgroundColor: colors.surfaceSoft },
  priorityText: { fontSize: 12, fontWeight: '800' },
  priorityHighText: { color: colors.textOnPrimary },
  priorityNormalText: { color: colors.textSecondary },
  resolveButton: { minHeight: 46, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  resolveButtonDisabled: { opacity: 0.6 },
  resolveButtonText: { color: colors.textOnPrimary, fontSize: 14, fontWeight: '800' },
  emptyCard: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 20, alignItems: 'center' },
  emptyTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '800' },
  emptyBody: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 6, textAlign: 'center' },
});
