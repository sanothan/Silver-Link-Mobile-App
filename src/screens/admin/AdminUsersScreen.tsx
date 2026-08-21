import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebaseConfig';
import { colors } from '../../theme/colors';

type LoadState = 'loading' | 'ready' | 'error';
type RoleCounts = { elderly: number; volunteer: number; caregiver: number; admin: number; suspended: number };

const EMPTY_COUNTS: RoleCounts = { elderly: 0, volunteer: 0, caregiver: 0, admin: 0, suspended: 0 };

export default function AdminUsersScreen() {
  const [state, setState] = useState<LoadState>('loading');
  const [counts, setCounts] = useState<RoleCounts>(EMPTY_COUNTS);

  const load = useCallback(async () => {
    if (!db) { setState('error'); return; }
    setState('loading');
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const next: RoleCounts = { ...EMPTY_COUNTS };
      snapshot.docs.forEach((item) => {
        const data = item.data();
        const role = typeof data.role === 'string' ? data.role : '';
        if (role === 'elderly' || role === 'volunteer' || role === 'caregiver' || role === 'admin') next[role] += 1;
        if (data.status === 'suspended') next.suspended += 1;
      });
      setCounts(next);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (state === 'loading') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerText}>Loading users…</Text>
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
        <Text style={styles.title}>User Management</Text>
        <Text style={styles.subtitle}>Registered accounts by role.</Text>

        <View style={styles.cards}>
          <View style={styles.row}><Text style={styles.rowLabel}>Elderly</Text><Text style={styles.rowValue}>{counts.elderly}</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>Volunteers</Text><Text style={styles.rowValue}>{counts.volunteer}</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>Caregivers</Text><Text style={styles.rowValue}>{counts.caregiver}</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>Admins</Text><Text style={styles.rowValue}>{counts.admin}</Text></View>
          <View style={[styles.row, styles.rowLast]}><Text style={styles.rowLabel}>Suspended</Text><Text style={[styles.rowValue, counts.suspended > 0 && styles.rowValueWarning]}>{counts.suspended}</Text></View>
        </View>

        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Coming soon</Text>
          <Text style={styles.noticeBody}>Search, role filters, and account actions (warn, suspend, block) will be available here.</Text>
        </View>
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
  cards: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 17 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  rowValue: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  rowValueWarning: { color: colors.error },
  noticeCard: { backgroundColor: colors.surfaceSoft, borderRadius: 16, padding: 16, marginTop: 16 },
  noticeTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '800' },
  noticeBody: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 4 },
});
