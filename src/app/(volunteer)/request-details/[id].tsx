import { type Href, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';
import { getMatchingRequestIds } from '../../../services/requestMatchingService';
import { acceptRequest, getRequestForVolunteerView, RequestAcceptanceError, RequestWithdrawalError, withdrawFromActivity, updateAssignedRequestStatus } from '../../../services/requestService';
import { getVolunteerAvailability } from '../../../services/volunteerAvailabilityService';
import { colors } from '../../../theme/colors';
import { canChatForStatus } from '../../../types/chat';
import { REQUEST_STATUS_LABELS, type CompanionshipRequest } from '../../../types/request';

export default function VolunteerRequestDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [item, setItem] = useState<CompanionshipRequest | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(false);
  const [matchesAvailability, setMatchesAvailability] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const withdrawing = useRef(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const load = useCallback(async () => { if (!user || !id) return; setLoading(true); setError(false); try { const request = await getRequestForVolunteerView(id, user.uid); setItem(request); const availability = await getVolunteerAvailability(user.uid).catch(() => null); setMatchesAvailability(availability ? getMatchingRequestIds([request], availability).has(request.id) : null); } catch { setError(true); } finally { setLoading(false); } }, [id, user]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const advance = async (nextStatus: 'in_progress' | 'completed') => {
    if (!user || !id) return; setSaving(true);
    try { setItem(await updateAssignedRequestStatus(id, user.uid, nextStatus)); }
    catch { Alert.alert("We couldn't update this visit", 'Please refresh and try again.'); }
    finally { setSaving(false); }
  };
  const accept = async () => {
    if (!user || !id) return; setSaving(true);
    try {
      await acceptRequest(id, user.uid);
      Alert.alert('Request Accepted', 'This activity has been added to your upcoming activities.', [
        { text: 'View Upcoming Activities', onPress: () => router.replace('/(volunteer)/activities') },
      ]);
      void load();
    } catch (cause) {
      const message = cause instanceof RequestAcceptanceError ? cause.message : "We couldn't accept this request. Please try again.";
      Alert.alert(cause instanceof RequestAcceptanceError && cause.reason === 'already-accepted' ? 'This request is no longer available.' : "We couldn't accept this request", message);
      void load();
    } finally { setSaving(false); }
  };
  const confirmAccept = () => item && Alert.alert('Accept this request?', `${item.activityType} on ${item.preferredDate.toLocaleDateString()} at ${item.preferredTime}.`, [{ text: 'Not now', style: 'cancel' }, { text: 'Accept', onPress: () => void accept() }]);

  const withdraw = async () => {
    if (!user || !id || withdrawing.current || saving) return;
    withdrawing.current = true;
    setIsWithdrawing(true);
    setSaving(true);
    try {
      await withdrawFromActivity(id, user.uid);
      router.replace('/(volunteer)/activities');
      Alert.alert('Withdrawal Confirmed', 'You have been removed from this activity.');
    } catch (cause) {
      Alert.alert("We couldn't withdraw from this activity", cause instanceof RequestWithdrawalError ? cause.message : 'Please try again.');
      await load();
    } finally {
      withdrawing.current = false;
      setIsWithdrawing(false);
      setSaving(false);
    }
  };
  const confirmWithdrawal = () => Alert.alert('Withdraw from this activity?',
    'The elderly user will be informed and the request may become available to other volunteers again.',
    [{ text: 'Keep Activity', style: 'cancel' }, { text: 'Withdraw', style: 'destructive', onPress: () => void withdraw() }]);

  if (loading) return <Center><ActivityIndicator size="large" color={colors.primary} /></Center>;
  if (error || !item) return <Center><Text style={styles.title}>Request unavailable</Text><Text style={styles.body}>It may not exist, or it may no longer be available.</Text></Center>;

  const isOpen = item.status === 'pending' && !item.assignedVolunteerId;
  const isMine = item.assignedVolunteerId === user?.uid;

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Text style={styles.link}>← Back</Text></Pressable>
      <Text style={styles.title}>{item.activityType}</Text>
      <View style={styles.status}><Text style={styles.statusText}>{REQUEST_STATUS_LABELS[item.status]}</Text></View>
      <Section label="What they need" value={item.description || 'No additional description'} />
      <Section label="Date and time" value={`${item.preferredDate.toLocaleDateString()} at ${item.preferredTime}`} />
      <Section label="Duration" value={item.durationLabel || (item.durationMinutes ? `${item.durationMinutes} minutes` : 'Flexible')} />
      <Section label="Location" value={item.location} />
      {isOpen && matchesAvailability !== null ? <View accessibilityRole="text" style={[styles.availabilityStatus, matchesAvailability ? styles.availabilityMatch : styles.availabilityOutside]}><Text style={[styles.availabilityStatusText, matchesAvailability ? styles.availabilityMatchText : styles.availabilityOutsideText]}>{matchesAvailability ? '✓ This request fits your current availability.' : 'This request is outside your saved availability.'}</Text></View> : null}
      {isMine && item.createdByName ? <View style={styles.card}><Text style={styles.label}>REQUESTED BY</Text><Text style={styles.value}>{item.createdByName}</Text></View> : null}
      {isOpen ? <Pressable accessibilityRole="button" accessibilityLabel="Accept this request" disabled={saving} style={[styles.action, saving && styles.disabled]} onPress={confirmAccept}><Text style={styles.actionText}>{saving ? 'Accepting…' : 'Accept Request'}</Text></Pressable> : null}
      {isMine && item.status === 'scheduled' ? <Pressable accessibilityRole="button" accessibilityLabel="Start this visit" disabled={saving} style={[styles.action, saving && styles.disabled]} onPress={() => void advance('in_progress')}><Text style={styles.actionText}>{saving ? 'Updating…' : 'Start Visit'}</Text></Pressable> : null}
      {isMine && item.status === 'in_progress' ? <Pressable accessibilityRole="button" accessibilityLabel="Mark this visit completed" disabled={saving} style={[styles.action, saving && styles.disabled]} onPress={() => void advance('completed')}><Text style={styles.actionText}>{saving ? 'Updating…' : 'Complete Visit'}</Text></Pressable> : null}
      {isMine && item.caregiverId && canChatForStatus(item.status) ? <Pressable accessibilityRole="button" accessibilityLabel="Message caregiver" style={styles.chatAction} onPress={() => router.push(`/(volunteer)/request-chat/${item.id}` as Href)}><Text style={styles.chatActionText}>Message Caregiver</Text></Pressable> : null}
      {isMine && ['accepted', 'scheduled'].includes(item.status) ? <Pressable accessibilityRole="button" accessibilityLabel="Withdraw From Activity" disabled={saving} onPress={confirmWithdrawal} style={[styles.chatAction, { borderColor: colors.error }, saving && styles.disabled]}>
        {isWithdrawing ? <ActivityIndicator color={colors.error} /> : null}
        <Text style={[styles.chatActionText, { color: colors.error }]}>{isWithdrawing ? 'Withdrawing...' : 'Withdraw From Activity'}</Text>
      </Pressable> : null}
    </ScrollView>
  </SafeAreaView>;
}

function Section({ label, value }: { label: string; value: string }) { return <View style={styles.card}><Text style={styles.label}>{label.toUpperCase()}</Text><Text style={styles.value}>{value}</Text></View>; }
function Center({ children }: { children: React.ReactNode }) { return <SafeAreaView style={styles.safe}><View style={styles.center}>{children}</View></SafeAreaView>; }

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, content: { padding: 20, paddingBottom: 40, gap: 12 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 25 }, back: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' }, link: { color: colors.primary, fontSize: 16, fontWeight: '800' }, title: { color: colors.textPrimary, fontSize: 28, fontWeight: '800', textAlign: 'center' }, body: { color: colors.textSecondary, fontSize: 17, lineHeight: 24, textAlign: 'center', marginTop: 10 }, status: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: colors.primaryLight, paddingHorizontal: 13, paddingVertical: 8, marginBottom: 8 }, statusText: { color: colors.primaryDark, fontSize: 15, fontWeight: '800' }, card: { backgroundColor: colors.surface, borderRadius: 17, borderWidth: 1, borderColor: colors.border, padding: 17 }, label: { color: colors.textSecondary, fontSize: 13, fontWeight: '800', letterSpacing: 0.6 }, value: { color: colors.textPrimary, fontSize: 18, lineHeight: 25, fontWeight: '700', marginTop: 6 }, availabilityStatus: { borderRadius: 14, padding: 14 }, availabilityMatch: { backgroundColor: colors.successLight }, availabilityOutside: { backgroundColor: colors.primaryLight }, availabilityStatusText: { fontSize: 16, lineHeight: 22, fontWeight: '800' }, availabilityMatchText: { color: colors.success }, availabilityOutsideText: { color: colors.primaryDark }, action: { minHeight: 58, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 8 }, actionText: { color: colors.textOnPrimary, fontSize: 18, fontWeight: '800' }, chatAction: { minHeight: 56, borderRadius: 15, borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 8 }, chatActionText: { color: colors.primary, fontSize: 18, fontWeight: '800' }, disabled: { opacity: 0.55 } });
