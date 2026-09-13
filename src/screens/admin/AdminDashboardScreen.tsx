import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAdminDashboard } from '../../services/adminDashboardService';
import { colors } from '../../theme/colors';
import type { AdminDashboardData } from '../../types/admin';
import { formatRelativeTime } from '../../utils/time';

type LoadState = 'loading' | 'ready' | 'error';

type SummaryCard = { id: string; label: string; value: number; tone?: 'error'; href?: Href };
type QuickAction = { id: string; label: string; icon: string; href?: Href };

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'users', label: 'Users', icon: '👥', href: '/(admin)/users' as Href },
  { id: 'verify', label: 'Verify', icon: '✅', href: '/(admin)/verify' as Href },
  { id: 'requests', label: 'Requests', icon: '📋' },
  { id: 'reports', label: 'Reports', icon: '⚠', href: '/(admin)/reports' as Href },
];

function SummaryCardTile({ card, onPress }: { card: SummaryCard; onPress?: () => void }) {
  const Wrapper = card.href ? Pressable : View;
  return (
    <Wrapper accessibilityRole={card.href ? 'button' : undefined} style={styles.statTile} onPress={onPress}>
      <Text style={[styles.statValue, card.tone === 'error' && card.value > 0 && styles.statValueError]}>{card.value}</Text>
      <Text style={styles.statLabel}>{card.label}</Text>
    </Wrapper>
  );
}

export default function AdminDashboardScreen() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>('loading');
  const [data, setData] = useState<AdminDashboardData | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      setData(await getAdminDashboard());
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (state === 'loading') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerText}>Loading admin dashboard…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (state === 'error') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.centerHeading}>We couldn&apos;t load the admin dashboard.</Text>
          <Text style={styles.centerText}>Please try again.</Text>
          <Pressable accessibilityRole="button" style={styles.retryButton} onPress={() => void load()}>
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const dashboard = data!;
  const { stats, actionItems } = dashboard;

  const summaryCards: SummaryCard[] = [
    { id: 'totalUsers', label: 'Total Users', value: stats.totalUsers, href: '/(admin)/users' as Href },
    { id: 'activeVolunteers', label: 'Active Volunteers', value: stats.activeVolunteers, href: '/(admin)/users' as Href },
    { id: 'pendingVerifications', label: 'Pending Verifications', value: stats.pendingVerifications, href: '/(admin)/verify' as Href },
    { id: 'activeRequests', label: 'Active Requests', value: stats.activeRequests },
    { id: 'completedActivities', label: 'Completed Activities', value: stats.completedActivities },
    { id: 'openReports', label: 'Open Reports', value: stats.openReports, tone: 'error', href: '/(admin)/reports' as Href },
  ];

  const safetyCount = actionItems.filter((item) => item.type === 'safety').length;
  const verificationCount = actionItems.filter((item) => item.type === 'verification').length;
  const complaintCount = actionItems.filter((item) => item.type === 'complaint').length;
  const topSafetyItem = actionItems.find((item) => item.type === 'safety');

  const attentionRows = [
    safetyCount > 0 ? { id: 'safety', icon: '⚠', label: `Safety Report${safetyCount === 1 ? '' : 's'}`, count: safetyCount, href: '/(admin)/reports' as Href } : null,
    verificationCount > 0 ? { id: 'verification', icon: '✅', label: `Volunteer Verification${verificationCount === 1 ? '' : 's'}`, count: verificationCount, href: '/(admin)/verify' as Href } : null,
    complaintCount > 0 ? { id: 'complaint', icon: '✉', label: `User Complaint${complaintCount === 1 ? '' : 's'}`, count: complaintCount, href: '/(admin)/reports' as Href } : null,
  ].filter((row): row is { id: string; icon: string; label: string; count: number; href: Href } => row !== null);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.eyebrow}>SilverLink Admin</Text>
            <Text style={styles.greeting}>Admin Dashboard</Text>
            <Text style={styles.subtitle}>Monitor SilverLink activity and safety.</Text>
          </View>
          <View style={styles.headerControls}>
            <Pressable accessibilityRole="button" accessibilityLabel="Open reports" style={styles.iconButton} onPress={() => router.push('/(admin)/reports' as Href)}>
              <Text style={styles.iconButtonText}>🔔</Text>
              {stats.openReports > 0 ? <View style={styles.iconBadge} /> : null}
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Open profile" style={styles.iconButton} onPress={() => router.push('/(admin)/profile' as Href)}>
              <Text style={styles.iconButtonText}>●</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.statGrid}>
            {summaryCards.map((card) => (
              <SummaryCardTile key={card.id} card={card} onPress={card.href ? () => router.push(card.href!) : undefined} />
            ))}
          </View>
        </View>

        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Needs Attention</Text>
          {attentionRows.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardDetail}>Nothing needs your attention right now.</Text>
            </View>
          ) : (
            <View style={styles.cards}>
              {topSafetyItem ? (
                <Pressable accessibilityRole="button" style={styles.safetyAlertCard} onPress={() => router.push('/(admin)/reports' as Href)}>
                  <View style={styles.safetyAlertTop}>
                    <Text style={styles.safetyAlertIcon}>⚠</Text>
                    <View style={styles.safetyAlertCopy}>
                      <Text style={styles.safetyAlertTitle}>Safety Alert</Text>
                      <View style={styles.priorityBadge}><Text style={styles.priorityBadgeText}>High Priority</Text></View>
                      <Text style={styles.safetyAlertTime}>Report received {formatRelativeTime(topSafetyItem.createdAt)}</Text>
                    </View>
                  </View>
                  <Text style={styles.reviewLink}>Review →</Text>
                </Pressable>
              ) : null}
              {attentionRows.map((row) => (
                <Pressable key={row.id} accessibilityRole="button" style={styles.attentionRow} onPress={() => router.push(row.href)}>
                  <Text style={styles.attentionIcon}>{row.icon}</Text>
                  <Text style={styles.attentionLabel}>{row.count} {row.label}</Text>
                  <Text style={styles.attentionArrow}>→</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionGrid}>
            {QUICK_ACTIONS.map((action) => (
              <Pressable
                key={action.id}
                accessibilityRole="button"
                style={styles.actionCard}
                onPress={() => (action.href ? router.push(action.href) : undefined)}
              >
                <Text style={styles.actionIcon}>{action.icon}</Text>
                <Text style={styles.actionTitle}>{action.label}</Text>
                {!action.href ? <Text style={styles.actionSoon}>Coming soon</Text> : null}
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.card}>
            <Text style={styles.cardDetail}>Platform activity will appear here as it happens.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  centerText: { color: colors.textSecondary, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  centerHeading: { color: colors.textPrimary, fontWeight: '800', fontSize: 20, lineHeight: 27, textAlign: 'center' },
  retryButton: { minHeight: 48, minWidth: 130, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  retryText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '800' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 },
  headerTextWrap: { flex: 1, paddingRight: 12 },
  eyebrow: { fontSize: 12, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  greeting: { fontSize: 25, lineHeight: 31, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  subtitle: { fontSize: 15, lineHeight: 21, color: colors.textSecondary },
  headerControls: { flexDirection: 'row', gap: 8 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonText: { fontSize: 18 },
  iconBadge: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.error },
  sectionWrap: { marginBottom: 24 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  statTile: {
    width: '31%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  statValue: { fontSize: 21, fontWeight: '800', color: colors.primary },
  statValueError: { color: colors.error },
  statLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, marginTop: 4, textAlign: 'center' },
  cards: { gap: 11 },
  card: { backgroundColor: colors.surface, borderRadius: 18, borderColor: colors.border, borderWidth: 1, padding: 17 },
  cardDetail: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  safetyAlertCard: { backgroundColor: colors.errorLight, borderRadius: 18, borderWidth: 1, borderColor: colors.error, padding: 17 },
  safetyAlertTop: { flexDirection: 'row', gap: 12 },
  safetyAlertIcon: { fontSize: 22 },
  safetyAlertCopy: { flex: 1 },
  safetyAlertTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '800' },
  priorityBadge: { alignSelf: 'flex-start', backgroundColor: colors.error, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, marginTop: 6 },
  priorityBadgeText: { color: colors.textOnPrimary, fontSize: 11, fontWeight: '800' },
  safetyAlertTime: { color: colors.textSecondary, fontSize: 13, marginTop: 6 },
  reviewLink: { color: colors.error, fontSize: 14, fontWeight: '800', textAlign: 'right', marginTop: 10 },
  attentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  attentionIcon: { fontSize: 18 },
  attentionLabel: { flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  attentionArrow: { color: colors.textSecondary, fontSize: 16 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  actionCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    minHeight: 92,
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  actionIcon: { fontSize: 22, marginBottom: 8 },
  actionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  actionSoon: { fontSize: 11, fontWeight: '700', color: colors.textMuted, marginTop: 3 },
});
