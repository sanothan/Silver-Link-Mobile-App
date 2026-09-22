import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listUsers } from '../../services/adminDashboardService';
import { colors } from '../../theme/colors';
import type { AdminUserRow } from '../../types/admin';

type LoadState = 'loading' | 'ready' | 'error';
type RoleCounts = { elderly: number; volunteer: number; caregiver: number; admin: number; suspended: number };

const EMPTY_COUNTS: RoleCounts = { elderly: 0, volunteer: 0, caregiver: 0, admin: 0, suspended: 0 };

function countByRole(users: AdminUserRow[]): RoleCounts {
  const next: RoleCounts = { ...EMPTY_COUNTS };
  users.forEach((user) => {
    if (user.role === 'elderly' || user.role === 'volunteer' || user.role === 'caregiver' || user.role === 'admin') next[user.role] += 1;
    if (user.status === 'suspended') next.suspended += 1;
  });
  return next;
}

export default function AdminUsersScreen() {
  const [state, setState] = useState<LoadState>('loading');
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setState('loading');
    try {
      const next = await listUsers();
      setUsers(next);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const counts = useMemo(() => countByRole(users), [users]);

  const filteredUsers = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return users;
    return users.filter((user) =>
      user.fullName.toLowerCase().includes(trimmed) ||
      user.email.toLowerCase().includes(trimmed) ||
      user.role.toLowerCase().includes(trimmed)
    );
  }, [users, query]);

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
        <Text style={styles.title}>User Management</Text>
        <Text style={styles.subtitle}>Registered accounts by role.</Text>

        <View style={styles.cards}>
          <View style={styles.row}><Text style={styles.rowLabel}>Elderly</Text><Text style={styles.rowValue}>{counts.elderly}</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>Volunteers</Text><Text style={styles.rowValue}>{counts.volunteer}</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>Caregivers</Text><Text style={styles.rowValue}>{counts.caregiver}</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>Admins</Text><Text style={styles.rowValue}>{counts.admin}</Text></View>
          <View style={[styles.row, styles.rowLast]}><Text style={styles.rowLabel}>Suspended</Text><Text style={[styles.rowValue, counts.suspended > 0 && styles.rowValueWarning]}>{counts.suspended}</Text></View>
        </View>

        <Text style={styles.sectionTitle}>All Users</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, email, or role"
          placeholderTextColor={colors.inputPlaceholder}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search users"
        />

        {filteredUsers.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No users found</Text>
            <Text style={styles.emptyBody}>Try a different search term.</Text>
          </View>
        ) : (
          <View style={styles.userCards}>
            {filteredUsers.map((user) => (
              <View key={user.uid} style={styles.userCard}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle}>{user.fullName}</Text>
                  <View style={[styles.statusBadge, user.status === 'suspended' && styles.statusBadgeError, user.status === 'active' && styles.statusBadgeSuccess]}>
                    <Text style={styles.statusBadgeText}>{user.status}</Text>
                  </View>
                </View>
                {user.email ? <Text style={styles.cardDetail}>{user.email}</Text> : null}
                <Text style={styles.cardRole}>{user.role}</Text>
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
  cards: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 17 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  rowValue: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  rowValueWarning: { color: colors.error },
  sectionTitle: { fontSize: 18, lineHeight: 24, fontWeight: '800', color: colors.textPrimary, marginTop: 24, marginBottom: 12 },
  searchInput: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, paddingHorizontal: 14, fontSize: 15, color: colors.textPrimary, marginBottom: 14 },
  userCards: { gap: 10 },
  userCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 15 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardTitle: { flex: 1, color: colors.textPrimary, fontSize: 16, lineHeight: 22, fontWeight: '800' },
  cardDetail: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 4 },
  cardRole: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: 6, textTransform: 'capitalize' },
  statusBadge: { backgroundColor: colors.surfaceSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeSuccess: { backgroundColor: colors.successLight },
  statusBadgeError: { backgroundColor: colors.errorLight },
  statusBadgeText: { color: colors.textPrimary, fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
  emptyCard: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 20, alignItems: 'center' },
  emptyTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '800' },
  emptyBody: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 6, textAlign: 'center' },
});
