import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { acceptRequest, getOpenRequests } from '../../services/requestService';
import { getUserProfile } from '../../services/userService';
import { colors } from '../../theme/colors';
import type { CompanionshipRequest } from '../../types/request';

export default function Explore() {
  const { user } = useAuth();
  const [items, setItems] = useState<CompanionshipRequest[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(false); const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); setError(false); try { setItems(await getOpenRequests()); } catch { setError(true); } finally { setLoading(false); } }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const accept = async (item: CompanionshipRequest) => {
    if (!user) return;
    setAcceptingId(item.id);
    try {
      const profile = await getUserProfile(user.uid).catch(() => null);
      await acceptRequest(item.id, { uid: user.uid, fullName: profile?.fullName || user.displayName?.trim() || 'A SilverLink volunteer', verified: profile?.status === 'active' });
      Alert.alert('Request accepted', 'We have let them know that you are coming.');
      await load();
    } catch (cause) {
      Alert.alert("We couldn't accept this request", cause instanceof Error ? cause.message : 'Please try again.');
    } finally { setAcceptingId(null); }
  };

  const confirm = (item: CompanionshipRequest) => Alert.alert('Accept this request?', `${item.activityType} on ${item.preferredDate.toLocaleDateString()} at ${item.preferredTime}.`, [{ text: 'Not now', style: 'cancel' }, { text: 'Accept', onPress: () => void accept(item) }]);

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <View style={styles.header}><Text style={styles.title}>Explore Opportunities</Text><Text style={styles.subtitle}>Requests waiting for a volunteer.</Text></View>
    {loading ? <Center><ActivityIndicator size="large" color={colors.primary} /></Center>
      : error ? <Center><Text style={styles.emptyTitle}>We couldn&apos;t load opportunities.</Text><Pressable accessibilityRole="button" style={styles.retry} onPress={() => void load()}><Text style={styles.retryText}>Try Again</Text></Pressable></Center>
      : <ScrollView contentContainerStyle={styles.list}>{items.length ? items.map((item) => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.cardTitle}>{item.activityType}</Text>
            <Text style={styles.meta}>{item.preferredDate.toLocaleDateString()} • {item.preferredTime}</Text>
            <Text style={styles.meta}>{item.location}</Text>
            {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
            <Pressable accessibilityRole="button" accessibilityLabel={`Accept ${item.activityType} request`} disabled={acceptingId !== null} style={[styles.primary, acceptingId !== null && styles.primaryDisabled]} onPress={() => confirm(item)}>
              <Text style={styles.primaryText}>{acceptingId === item.id ? 'Accepting…' : 'Accept Request'}</Text>
            </Pressable>
          </View>
        )) : <Center><Text style={styles.emptyTitle}>No open requests right now</Text><Text style={styles.emptyText}>Check back soon — new requests appear here as they are posted.</Text></Center>}</ScrollView>}
  </SafeAreaView>;
}

function Center({ children }: { children: React.ReactNode }) { return <View style={styles.center}>{children}</View>; }

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, header: { paddingHorizontal: 20, paddingTop: 14 }, title: { color: colors.textPrimary, fontSize: 26, fontWeight: '800' }, subtitle: { color: colors.textSecondary, fontSize: 16, marginTop: 6 }, list: { padding: 20, paddingBottom: 35, gap: 12, flexGrow: 1 }, card: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 18 }, cardTitle: { color: colors.textPrimary, fontSize: 19, fontWeight: '800' }, meta: { color: colors.textSecondary, fontSize: 16, marginTop: 7 }, description: { color: colors.textPrimary, fontSize: 16, lineHeight: 23, marginTop: 9 }, primary: { minHeight: 52, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 15 }, primaryDisabled: { backgroundColor: colors.disabled }, primaryText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '800' }, center: { flex: 1, minHeight: 260, alignItems: 'center', justifyContent: 'center', padding: 24 }, emptyTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '800', textAlign: 'center' }, emptyText: { color: colors.textSecondary, fontSize: 16, lineHeight: 23, textAlign: 'center', marginTop: 8 }, retry: { minHeight: 52, borderRadius: 13, backgroundColor: colors.primary, paddingHorizontal: 20, justifyContent: 'center', marginTop: 16 }, retryText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '800' } });
