import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { approveVolunteer, getAdminDashboard } from '../../services/adminDashboardService';
import { colors } from '../../theme/colors';
import type { PendingVolunteer } from '../../types/admin';
import { formatDate } from '../../utils/time';

type LoadState = 'loading' | 'ready' | 'error';

export default function AdminVerificationsScreen() {
  const [state, setState] = useState<LoadState>('loading');
  const [volunteers, setVolunteers] = useState<PendingVolunteer[]>([]);
  const [workingUid, setWorkingUid] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const dashboard = await getAdminDashboard();
      setVolunteers(dashboard.pendingVolunteers);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const handleApprove = useCallback(async (volunteer: PendingVolunteer) => {
    setWorkingUid(volunteer.uid);
    try {
      await approveVolunteer(volunteer.uid);
      setVolunteers((current) => current.filter((item) => item.uid !== volunteer.uid));
    } catch {
      Alert.alert('Approval failed', 'Could not approve this volunteer. Please try again.');
    } finally {
      setWorkingUid(null);
    }
  }, []);

  if (state === 'loading') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerText}>Loading verifications…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (state === 'error') {
    return (
      <SafeAreaView style={styles.safe}>
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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Pending Verifications</Text>
        <Text style={styles.subtitle}>Review volunteer applications waiting for approval.</Text>

        {volunteers.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>All caught up</Text>
            <Text style={styles.emptyBody}>There are no volunteer verifications waiting for review.</Text>
          </View>
        ) : (
          <View style={styles.cards}>
            {volunteers.map((volunteer) => (
              <View key={volunteer.uid} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle}>{volunteer.fullName}</Text>
                  <View style={styles.statusBadge}><Text style={styles.statusBadgeText}>Pending</Text></View>
                </View>
                {volunteer.email ? <Text style={styles.cardDetail}>{volunteer.email}</Text> : null}
                <Text style={styles.cardDetail}>Submitted {formatDate(volunteer.submittedAt)}</Text>
                <Pressable
                  accessibilityRole="button"
                  style={[styles.approveButton, workingUid === volunteer.uid && styles.approveButtonDisabled]}
                  onPress={() => void handleApprove(volunteer)}
                  disabled={workingUid === volunteer.uid}
                >
                  <Text style={styles.approveButtonText}>{workingUid === volunteer.uid ? 'Approving…' : 'Review & Approve'}</Text>
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
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardTitle: { flex: 1, color: colors.textPrimary, fontSize: 16, lineHeight: 22, fontWeight: '800' },
  cardDetail: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 4 },
  statusBadge: { backgroundColor: colors.warningLight, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeText: { color: '#92400E', fontSize: 12, fontWeight: '800' },
  approveButton: { minHeight: 46, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  approveButtonDisabled: { opacity: 0.6 },
  approveButtonText: { color: colors.textOnPrimary, fontSize: 14, fontWeight: '800' },
  emptyCard: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 20, alignItems: 'center' },
  emptyTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '800' },
  emptyBody: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 6, textAlign: 'center' },
});
