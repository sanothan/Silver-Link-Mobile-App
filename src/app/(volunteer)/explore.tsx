import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getOpenRequests } from '../../services/requestService';
import { colors } from '../../theme/colors';
import type { CompanionshipRequest } from '../../types/request';

function formatDuration(item: CompanionshipRequest): string | null {
  if (item.durationLabel) return item.durationLabel;
  if (item.durationMinutes) return item.durationMinutes >= 60 ? `${(item.durationMinutes / 60).toFixed(item.durationMinutes % 60 ? 1 : 0)} hour${item.durationMinutes === 60 ? '' : 's'}` : `${item.durationMinutes} min`;
  return null;
}

export default function Explore() {
  const router = useRouter();
  const [items, setItems] = useState<CompanionshipRequest[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(false);
  const load = useCallback(async () => { setLoading(true); setError(false); try { setItems(await getOpenRequests()); } catch { setError(true); } finally { setLoading(false); } }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <View style={styles.header}><Text style={styles.title}>Available Requests</Text><Text style={styles.subtitle}>Find an opportunity that matches your time and interests.</Text></View>
    {loading ? <Center><ActivityIndicator size="large" color={colors.primary} /></Center>
      : error ? <Center><Text style={styles.emptyTitle}>We couldn&apos;t load available requests.</Text><Text style={styles.emptyText}>Please try again.</Text><Pressable accessibilityRole="button" style={styles.retry} onPress={() => void load()}><Text style={styles.retryText}>Try Again</Text></Pressable></Center>
      : <ScrollView contentContainerStyle={styles.list}>{items.length ? items.map((item) => {
          const duration = formatDuration(item);
          return (
            <View key={item.id} style={styles.card}>
              <Text style={styles.cardTitle}>{item.activityType}</Text>
              <Text style={styles.meta}>{item.preferredDate.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })} • {item.preferredTime}</Text>
              {duration ? <Text style={styles.meta}>{duration}</Text> : null}
              <Text style={styles.meta}>{item.location}</Text>
              {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
              <Pressable accessibilityRole="button" accessibilityLabel={`View details for ${item.activityType} request`} style={styles.primary} onPress={() => router.push(`/(volunteer)/request-details/${item.id}`)}>
                <Text style={styles.primaryText}>View Details</Text>
              </Pressable>
            </View>
          );
        }) : <Center><Text style={styles.emptyTitle}>No requests available right now.</Text><Text style={styles.emptyText}>New opportunities will appear here when elderly users request help.</Text><Pressable accessibilityRole="button" style={styles.retry} onPress={() => void load()}><Text style={styles.retryText}>Refresh</Text></Pressable></Center>}</ScrollView>}
  </SafeAreaView>;
}

function Center({ children }: { children: React.ReactNode }) { return <View style={styles.center}>{children}</View>; }

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, header: { paddingHorizontal: 20, paddingTop: 14 }, title: { color: colors.textPrimary, fontSize: 26, fontWeight: '800' }, subtitle: { color: colors.textSecondary, fontSize: 16, marginTop: 6 }, list: { padding: 20, paddingBottom: 35, gap: 12, flexGrow: 1 }, card: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 18, shadowColor: colors.shadow, shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 }, cardTitle: { color: colors.textPrimary, fontSize: 19, fontWeight: '800' }, meta: { color: colors.textSecondary, fontSize: 16, marginTop: 7 }, description: { color: colors.textPrimary, fontSize: 16, lineHeight: 23, marginTop: 9 }, primary: { minHeight: 52, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 15 }, primaryText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '800' }, center: { flex: 1, minHeight: 260, alignItems: 'center', justifyContent: 'center', padding: 24 }, emptyTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '800', textAlign: 'center' }, emptyText: { color: colors.textSecondary, fontSize: 16, lineHeight: 23, textAlign: 'center', marginTop: 8 }, retry: { minHeight: 52, borderRadius: 13, backgroundColor: colors.primary, paddingHorizontal: 20, justifyContent: 'center', marginTop: 16 }, retryText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '800' } });
