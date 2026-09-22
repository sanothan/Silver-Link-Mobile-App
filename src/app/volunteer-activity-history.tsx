import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatCategoryLabel } from '../services/communityImpactStats';
import { getCurrentViewer } from '../services/currentUser';
import { getMyVolunteerActivityHistory } from '../services/volunteerActivityHistory';
import { colors } from '../theme/colors';
import { ACTIVITY_STATUS_LABEL } from '../types/feedback';
import type { VolunteerActivityHistoryItem } from '../types/volunteer';

type Phase = 'loading' | 'ready' | 'error' | 'signed-out' | 'not-volunteer';

function formatActivityDate(date?: Date): string {
  if (!date) return 'Date not recorded';
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

export default function VolunteerActivityHistoryScreen() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [activities, setActivities] = useState<VolunteerActivityHistoryItem[]>([]);

  const load = useCallback(async () => {
    setPhase('loading');
    try {
      const viewer = await getCurrentViewer();
      if (!viewer) {
        setPhase('signed-out');
        return;
      }
      if (viewer.role !== 'volunteer') {
        setPhase('not-volunteer');
        return;
      }
      setActivities(await getMyVolunteerActivityHistory(viewer));
      setPhase('ready');
    } catch {
      setPhase('error');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (phase === 'loading') return <StateView loading message="Loading your activity history..." />;
  if (phase === 'signed-out') return <StateView title="Please sign in first" message="Sign in to view your volunteering activity history." />;
  if (phase === 'not-volunteer') return <StateView title="Volunteer account required" message="Activity history is available to volunteer accounts." />;
  if (phase === 'error') {
    return (
      <StateView title="We couldn't load your history" message="Please check your connection and try again.">
        <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={() => void load()}>
          <Text style={styles.primaryButtonText}>Try again</Text>
        </Pressable>
      </StateView>
    );
  }

  const completed = activities.filter((activity) => activity.status === 'completed');
  const cancelled = activities.filter((activity) => activity.status === 'cancelled');
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Activity history</Text>
        <Text style={styles.lead}>A record of the volunteering activities assigned to you.</Text>
        {activities.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No activity history yet</Text>
            <Text style={styles.emptyText}>Completed and cancelled activities will appear here once they are recorded.</Text>
          </View>
        ) : (
          <>
            <HistorySection title="Completed" activities={completed} />
            <HistorySection title="Cancelled" activities={cancelled} cancelled />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StateView({ loading, title, message, children }: { loading?: boolean; title?: string; message: string; children?: React.ReactNode }) {
  return <SafeAreaView style={styles.safe}><View style={styles.center}>{loading ? <ActivityIndicator size="large" color={colors.primary} /> : null}{title ? <Text style={styles.centerTitle}>{title}</Text> : null}<Text style={styles.centerText}>{message}</Text>{children}</View></SafeAreaView>;
}

function HistorySection({ title, activities, cancelled = false }: { title: string; activities: VolunteerActivityHistoryItem[]; cancelled?: boolean }) {
  if (activities.length === 0) return null;
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{activities.map((activity) => <View key={activity.id} style={styles.card} accessibilityLabel={`${formatCategoryLabel(activity.category)}, ${formatActivityDate(activity.activityDate)}, ${ACTIVITY_STATUS_LABEL[activity.status]}`}><View style={styles.cardHeader}><Text style={styles.category}>{formatCategoryLabel(activity.category)}</Text><View style={[styles.statusBadge, cancelled ? styles.cancelledBadge : styles.completedBadge]}><Text style={[styles.statusText, cancelled ? styles.cancelledText : styles.completedText]}>{ACTIVITY_STATUS_LABEL[activity.status]}</Text></View></View><Text style={styles.date}>{formatActivityDate(activity.activityDate)}</Text></View>)}</View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, content: { padding: 22, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  centerTitle: { color: colors.textPrimary, fontSize: 20, lineHeight: 27, fontWeight: '800', textAlign: 'center' },
  centerText: { color: colors.textSecondary, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  title: { color: colors.textPrimary, fontSize: 26, lineHeight: 33, fontWeight: '800' }, lead: { color: colors.textSecondary, fontSize: 16, lineHeight: 24, marginTop: 8 },
  section: { marginTop: 26, gap: 10 }, sectionTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '800' },
  card: { borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 16 }, cardHeader: { flexDirection: 'row', gap: 12, justifyContent: 'space-between', alignItems: 'flex-start' },
  category: { flex: 1, color: colors.textPrimary, fontSize: 16, lineHeight: 22, fontWeight: '800' }, date: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 8 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }, completedBadge: { backgroundColor: colors.successLight }, cancelledBadge: { backgroundColor: colors.errorLight },
  statusText: { fontSize: 12, fontWeight: '800' }, completedText: { color: colors.success }, cancelledText: { color: colors.error },
  emptyCard: { marginTop: 28, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 20 }, emptyTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '800' }, emptyText: { color: colors.textSecondary, fontSize: 15, lineHeight: 22, marginTop: 6 },
  primaryButton: { minHeight: 52, minWidth: 140, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 10, paddingHorizontal: 18 }, primaryButtonText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '800' },
});
