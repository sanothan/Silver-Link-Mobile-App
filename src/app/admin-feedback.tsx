import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCurrentViewer } from '../services/currentUser';
import {
  AUTHOR_ROLE_LABEL,
  FEEDBACK_FILTERS,
  FeedbackReviewAccessError,
  canReviewAllFeedback,
  isLowRated,
  summariseFeedback,
} from '../services/feedbackAdmin';
import type { FeedbackFilter } from '../services/feedbackAdmin';
import { getFeedbackForAdmin } from '../services/feedbackService';
import type { ReportViewer } from '../services/reportAccess';
import { colors } from '../theme/colors';
import { RATING_OPTIONS } from '../types/feedback';
import type { FeedbackRecord } from '../types/feedback';
import { formatRelativeTime } from '../utils/time';

type LoadState = 'loading' | 'ready' | 'denied' | 'error';

const RATING_LABEL: Record<number, string> = RATING_OPTIONS.reduce(
  (labels, option) => ({ ...labels, [option.value]: option.label }),
  {} as Record<number, string>,
);

export default function AdminFeedbackScreen() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>('loading');
  const [viewer, setViewer] = useState<ReportViewer | null>(null);
  const [feedback, setFeedback] = useState<FeedbackRecord[]>([]);
  const [filter, setFilter] = useState<FeedbackFilter>('all');

  const load = useCallback(async (current: ReportViewer | null, selected: FeedbackFilter) => {
    setState('loading');
    try {
      setFeedback(await getFeedbackForAdmin(current, selected));
      setState('ready');
    } catch (error) {
      setState(error instanceof FeedbackReviewAccessError ? 'denied' : 'error');
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const current = await getCurrentViewer();
      if (!active) return;
      setViewer(current);
      if (!canReviewAllFeedback(current)) {
        setState('denied');
        return;
      }
      await load(current, filter);
    })();
    return () => {
      active = false;
    };
  }, [filter, load]);

  // Coming back from another screen should show anything submitted in the meantime.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      if (canReviewAllFeedback(viewer)) void load(viewer, filter);
    }, [filter, load, viewer]),
  );

  if (state === 'denied') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.centerHeading}>Administrators only</Text>
          <Text style={styles.centerText}>
            Feedback names the people who wrote it and the activities it is about, so only
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
          <Text style={styles.centerText}>Loading feedback...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (state === 'error') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.centerHeading}>We could not load submitted feedback.</Text>
          <Pressable accessibilityRole="button" style={styles.retryButton} onPress={() => void load(viewer, filter)}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const summary = summariseFeedback(feedback);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Activity feedback</Text>
        <Text style={styles.subtitle}>What members, caregivers and volunteers said about completed activities.</Text>

        <View style={styles.summaryRow}>
          <SummaryTile label="Showing" value={String(summary.total)} />
          <SummaryTile
            label="Average rating"
            value={summary.averageRating === null ? 'No ratings' : `${summary.averageRating}/5`}
          />
          <SummaryTile label="Needs attention" value={String(summary.lowRated)} tone={summary.lowRated > 0} />
        </View>

        <View style={styles.filterRow}>
          {FEEDBACK_FILTERS.map((option) => (
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

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open safety reports"
          style={styles.linkCard}
          onPress={() => router.push('/(admin)/reports' as Href)}
        >
          <Text style={styles.linkCardTitle}>Safety reports</Text>
          <Text style={styles.linkCardBody}>Review concerns members raised and record how they were resolved.</Text>
          <Text style={styles.openLink}>Open reports &rsaquo;</Text>
        </Pressable>

        {feedback.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nothing to read yet</Text>
            <Text style={styles.emptyBody}>There is no feedback matching this filter.</Text>
          </View>
        ) : (
          <View style={styles.cards}>
            {feedback.map((entry) => {
              const low = isLowRated(entry);
              return (
                <View key={entry.id} style={[styles.card, low && styles.cardLow]}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardTitle}>{entry.activityTitle || 'Activity request'}</Text>
                    <View style={[styles.badge, low ? styles.badgeLow : styles.badgeNormal]}>
                      <Text style={[styles.badgeText, low ? styles.badgeTextLow : styles.badgeTextNormal]}>
                        {entry.rating === null ? 'No rating' : `${entry.rating}/5`}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.cardDetail}>
                    {AUTHOR_ROLE_LABEL[entry.authorRole]} - {formatRelativeTime(entry.createdAt)}
                  </Text>
                  {entry.rating === null ? null : (
                    <Text style={styles.cardDetail}>Rated {RATING_LABEL[entry.rating] ?? `${entry.rating} of 5`}</Text>
                  )}

                  <Text style={styles.message}>{entry.comment || 'No comment left.'}</Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: string; tone?: boolean }) {
  return (
    <View style={[styles.summaryTile, tone && styles.summaryTileAlert]}>
      <Text style={[styles.summaryValue, tone && styles.summaryValueAlert]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
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
  summaryRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  summaryTile: {
    flex: 1,
    minHeight: 82,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 12,
    justifyContent: 'center',
  },
  summaryTileAlert: { borderColor: colors.error, backgroundColor: colors.errorLight },
  summaryValue: { color: colors.textPrimary, fontSize: 20, lineHeight: 26, fontWeight: '800' },
  summaryValueAlert: { color: colors.error },
  summaryLabel: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, fontWeight: '700', marginTop: 2 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16, marginBottom: 16 },
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
  linkCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 17,
    marginBottom: 16,
  },
  linkCardTitle: { color: colors.textPrimary, fontSize: 16, lineHeight: 22, fontWeight: '800' },
  linkCardBody: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 4 },
  cards: { gap: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 17 },
  cardLow: { borderColor: colors.error, backgroundColor: colors.errorLight },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardTitle: { flex: 1, color: colors.textPrimary, fontSize: 16, lineHeight: 22, fontWeight: '800' },
  cardDetail: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 6 },
  message: { color: colors.textPrimary, fontSize: 14, lineHeight: 20, marginTop: 8 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeLow: { backgroundColor: colors.error },
  badgeNormal: { backgroundColor: colors.surfaceSoft },
  badgeText: { fontSize: 12, fontWeight: '800' },
  badgeTextLow: { color: colors.textOnPrimary },
  badgeTextNormal: { color: colors.textSecondary },
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
