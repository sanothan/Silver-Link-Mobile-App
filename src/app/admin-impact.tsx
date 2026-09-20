import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CommunityImpactAccessError, canViewCommunityImpact } from '../services/communityImpactAccess';
import { getCommunityImpact } from '../services/communityImpactService';
import type { CommunityImpactResult } from '../services/communityImpactService';
import { formatVolunteerHours } from '../services/communityImpactStats';
import { getCurrentViewer } from '../services/currentUser';
import type { ReportViewer } from '../services/reportAccess';
import { colors } from '../theme/Colors';
import { formatRelativeTime } from '../utils/time';

type LoadState = 'loading' | 'ready' | 'denied' | 'error';

/** One headline figure. `hint` explains what the number is counted from. */
function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <View style={styles.statCard} accessible accessibilityLabel={`${label}: ${value}. ${hint}`}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statHint}>{hint}</Text>
    </View>
  );
}

export default function AdminImpactScreen() {
  const [state, setState] = useState<LoadState>('loading');
  const [viewer, setViewer] = useState<ReportViewer | null>(null);
  const [result, setResult] = useState<CommunityImpactResult | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (current: ReportViewer | null, isRefresh = false) => {
    if (!isRefresh) setState('loading');
    try {
      setResult(await getCommunityImpact(current));
      setState('ready');
    } catch (error) {
      setState(error instanceof CommunityImpactAccessError ? 'denied' : 'error');
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const current = await getCurrentViewer();
      if (!active) return;
      setViewer(current);
      if (!canViewCommunityImpact(current)) {
        setState('denied');
        return;
      }
      await load(current);
    })();
    return () => {
      active = false;
    };
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load(viewer, true);
    setRefreshing(false);
  }, [load, viewer]);

  if (state === 'denied') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.centerHeading}>Administrators only</Text>
          <Text style={styles.centerText}>
            The community impact dashboard summarises every member and request on SilverLink, so
            only administrators can open it.
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
          <Text style={styles.centerText}>Calculating community impact...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (state === 'error' || !result) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.centerHeading}>We could not load the dashboard.</Text>
          <Pressable accessibilityRole="button" style={styles.retryButton} onPress={() => void load(viewer)}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const { stats, truncated } = result;
  const mostCommon = stats.topCategories[0];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />}
      >
        <Text style={styles.title}>Community impact</Text>
        <Text style={styles.subtitle}>
          How SilverLink is supporting the local community, counted from the records the platform
          holds right now.
        </Text>
        <Text style={styles.freshness}>Updated {formatRelativeTime(stats.calculatedAt).toLowerCase()}</Text>

        <Text style={styles.sectionHeading}>People</Text>
        <View style={styles.statGrid}>
          <StatCard
            label="Elderly members"
            value={String(stats.elderlyUsers)}
            hint="Registered with the elderly role"
          />
          <StatCard label="Volunteers" value={String(stats.volunteers)} hint="Registered to offer help" />
          <StatCard label="Caregivers" value={String(stats.caregivers)} hint="Registered to support a member" />
          <StatCard label="All members" value={String(stats.totalMembers)} hint="Every registered account" />
        </View>

        <Text style={styles.sectionHeading}>Activity</Text>
        <View style={styles.statGrid}>
          <StatCard
            label="Completed activities"
            value={String(stats.completedActivities)}
            hint="Requests marked completed"
          />
          <StatCard
            label="Active requests"
            value={String(stats.activeRequests)}
            hint="Open, assigned, or happening now"
          />
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Volunteering hours</Text>
          <Text style={styles.panelValue}>{formatVolunteerHours(stats)}</Text>
          <Text style={styles.panelHint}>
            {stats.volunteerHours === null
              ? 'No completed activity has recorded how long it took yet, so hours cannot be totalled.'
              : `Totalled from ${stats.activitiesWithHours} of ${stats.completedActivities} completed activities that recorded a duration.`}
          </Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Most common activities</Text>
          {stats.topCategories.length === 0 ? (
            <Text style={styles.panelHint}>No activities have been completed yet.</Text>
          ) : (
            <>
              <Text style={styles.panelHint}>
                {`"${mostCommon.label}" is the help SilverLink gives most often.`}
              </Text>
              <View style={styles.categoryList}>
                {stats.topCategories.map((category) => (
                  <View
                    key={category.value}
                    style={styles.categoryRow}
                    accessible
                    accessibilityLabel={`${category.label}: ${category.count} completed ${category.count === 1 ? 'activity' : 'activities'}`}
                  >
                    <Text style={styles.categoryLabel} numberOfLines={2}>
                      {category.label}
                    </Text>
                    {/* The bar is decoration on top of the count, which is always readable on its own. */}
                    <View style={styles.barTrack}>
                      <View
                        style={[styles.barFill, { width: `${Math.round((category.count / mostCommon.count) * 100)}%` }]}
                      />
                    </View>
                    <Text style={styles.categoryCount}>{category.count}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        {truncated ? (
          <Text style={styles.truncatedNote}>
            SilverLink now holds more records than one dashboard read covers, so these figures are a
            lower bound rather than the full total.
          </Text>
        ) : null}
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
  freshness: { fontSize: 13, lineHeight: 18, color: colors.textMuted, marginTop: 6 },
  sectionHeading: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 22,
    marginBottom: 10,
  },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 150,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  statValue: { color: colors.primary, fontSize: 30, lineHeight: 36, fontWeight: '800' },
  statLabel: { color: colors.textPrimary, fontSize: 15, lineHeight: 21, fontWeight: '800', marginTop: 4 },
  statHint: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 4 },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 17,
    marginTop: 18,
  },
  panelTitle: { color: colors.textPrimary, fontSize: 17, lineHeight: 23, fontWeight: '800' },
  panelValue: { color: colors.primary, fontSize: 26, lineHeight: 32, fontWeight: '800', marginTop: 6 },
  panelHint: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 6 },
  categoryList: { gap: 12, marginTop: 14 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  categoryLabel: { flex: 1, color: colors.textPrimary, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  barTrack: { flex: 1, height: 12, borderRadius: 999, backgroundColor: colors.surfaceSoft, overflow: 'hidden' },
  barFill: { height: 12, borderRadius: 999, backgroundColor: colors.primary },
  categoryCount: { minWidth: 28, textAlign: 'right', color: colors.textPrimary, fontSize: 16, fontWeight: '800' },
  truncatedNote: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 18, fontStyle: 'italic' },
});
