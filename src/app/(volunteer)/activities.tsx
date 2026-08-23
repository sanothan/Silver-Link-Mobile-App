import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { getVolunteerRequests } from '../../services/requestService';
import { colors } from '../../theme/colors';
import { REQUEST_STATUS_LABELS, type CompanionshipRequest } from '../../types/request';

const UPCOMING_STATUSES: CompanionshipRequest['status'][] = ['accepted', 'scheduled', 'in_progress'];

export default function Activities() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<CompanionshipRequest[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(false);
  const load = useCallback(async () => { if (!user) return; setLoading(true); setError(false); try { setItems(await getVolunteerRequests(user.uid)); } catch { setError(true); } finally { setLoading(false); } }, [user]);
  // Re-reads on every focus, so an activity accepted on Explore is already here.
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const upcoming = useMemo(() => items.filter((item) => UPCOMING_STATUSES.includes(item.status)), [items]);
  const past = useMemo(() => items.filter((item) => !UPCOMING_STATUSES.includes(item.status)), [items]);

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <View style={styles.header}><Text style={styles.title}>My Activities</Text><Text style={styles.subtitle}>Requests you have accepted.</Text></View>
    {loading ? <Center><ActivityIndicator size="large" color={colors.primary} /></Center>
      : error ? <Center><Text style={styles.emptyTitle}>We couldn&apos;t load your activities.</Text><Pressable accessibilityRole="button" style={styles.retry} onPress={() => void load()}><Text style={styles.retryText}>Try Again</Text></Pressable></Center>
      : <ScrollView contentContainerStyle={styles.list}>{items.length ? <>
          {upcoming.length ? <><Text style={styles.section}>UPCOMING</Text>{upcoming.map((item) => <Card key={item.id} item={item} onPress={() => router.push(`/(volunteer)/request-details/${item.id}` as Href)} />)}</> : null}
          {past.length ? <><Text style={styles.section}>PAST</Text>{past.map((item) => <Card key={item.id} item={item} onPress={() => router.push(`/(volunteer)/request-details/${item.id}` as Href)} />)}</> : null}
        </> : <Center><Text style={styles.emptyTitle}>No activities yet</Text><Text style={styles.emptyText}>Accept a request from Explore and it will appear here.</Text></Center>}</ScrollView>}
  </SafeAreaView>;
}

function Card({ item, onPress }: { item: CompanionshipRequest; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`View details for ${item.activityType}`} style={styles.card} onPress={onPress}>
    <Text style={styles.cardTitle}>{item.activityType}</Text>
    <View style={styles.status}><Text style={styles.statusText}>{REQUEST_STATUS_LABELS[item.status]}</Text></View>
    <Text style={styles.meta}>{item.preferredDate.toLocaleDateString()} • {item.preferredTime}</Text>
    <Text style={styles.meta}>{item.location}</Text>
    {item.durationLabel || item.durationMinutes ? <Text style={styles.meta}>{item.durationLabel || `${item.durationMinutes} minutes`}</Text> : null}
    {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
    {item.createdByName ? <Text style={styles.person}>For {item.createdByName}</Text> : null}
    <Text style={styles.link}>View Details →</Text>
  </Pressable>;
}

function Center({ children }: { children: React.ReactNode }) { return <View style={styles.center}>{children}</View>; }

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, header: { paddingHorizontal: 20, paddingTop: 14 }, title: { color: colors.textPrimary, fontSize: 26, fontWeight: '800' }, subtitle: { color: colors.textSecondary, fontSize: 16, marginTop: 6 }, list: { padding: 20, paddingBottom: 35, gap: 12, flexGrow: 1 }, section: { color: colors.textSecondary, fontSize: 13, fontWeight: '800', letterSpacing: 0.6, marginTop: 6 }, card: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 18 }, cardTitle: { color: colors.textPrimary, fontSize: 19, fontWeight: '800' }, status: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: colors.primaryLight, paddingHorizontal: 13, paddingVertical: 7, marginTop: 9 }, statusText: { color: colors.primaryDark, fontSize: 15, fontWeight: '800' }, meta: { color: colors.textSecondary, fontSize: 16, marginTop: 7 }, description: { color: colors.textPrimary, fontSize: 16, lineHeight: 23, marginTop: 9 }, person: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 9 }, link: { color: colors.primary, fontSize: 16, fontWeight: '800', marginTop: 13 }, center: { flex: 1, minHeight: 260, alignItems: 'center', justifyContent: 'center', padding: 24 }, emptyTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '800', textAlign: 'center' }, emptyText: { color: colors.textSecondary, fontSize: 16, lineHeight: 23, textAlign: 'center', marginTop: 8 }, retry: { minHeight: 52, borderRadius: 13, backgroundColor: colors.primary, paddingHorizontal: 20, justifyContent: 'center', marginTop: 16 }, retryText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '800' } });
