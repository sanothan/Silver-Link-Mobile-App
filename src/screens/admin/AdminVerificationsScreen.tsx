import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import {
  canVerifyVolunteers,
  decideVolunteerVerification,
  getVolunteerVerificationHistory,
  listVolunteerVerifications,
} from '../../services/volunteerVerificationService';
import { colors } from '../../theme/colors';
import type { VolunteerVerificationDecision, VolunteerVerificationRecord, VolunteerVerificationRow, VolunteerVerificationStatus } from '../../types/volunteer';
import { formatDate } from '../../utils/time';

type LoadState = 'loading' | 'ready' | 'error';
type TabKey = 'pending' | 'verified' | 'rejected';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'verified', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

const STATUS_LABEL: Record<VolunteerVerificationStatus, string> = {
  pending: 'Pending review',
  verified: 'Verified',
  rejected: 'Rejected',
  unverified: 'Unverified',
};

function matchesTab(status: VolunteerVerificationStatus, tab: TabKey): boolean {
  if (tab === 'pending') return status === 'pending' || status === 'unverified';
  return status === tab;
}

export default function AdminVerificationsScreen() {
  const { profile } = useAuth();
  const isAdmin = canVerifyVolunteers(profile);
  const [state, setState] = useState<LoadState>('loading');
  const [volunteers, setVolunteers] = useState<VolunteerVerificationRow[]>([]);
  const [tab, setTab] = useState<TabKey>('pending');
  const [workingUid, setWorkingUid] = useState<string | null>(null);
  const [pendingDecision, setPendingDecision] = useState<{ volunteer: VolunteerVerificationRow; decision: VolunteerVerificationDecision } | null>(null);
  const [note, setNote] = useState('');
  const [history, setHistory] = useState<{ volunteer: VolunteerVerificationRow; records: VolunteerVerificationRecord[] } | null>(null);

  const load = useCallback(async () => {
    if (!isAdmin) {
      setState('ready');
      return;
    }
    setState('loading');
    try {
      setVolunteers(await listVolunteerVerifications(profile));
      setState('ready');
    } catch {
      setState('error');
    }
  }, [isAdmin, profile]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const visible = useMemo(() => volunteers.filter((item) => matchesTab(item.verificationStatus, tab)), [volunteers, tab]);
  const counts = useMemo(() => ({
    pending: volunteers.filter((item) => matchesTab(item.verificationStatus, 'pending')).length,
    verified: volunteers.filter((item) => matchesTab(item.verificationStatus, 'verified')).length,
    rejected: volunteers.filter((item) => matchesTab(item.verificationStatus, 'rejected')).length,
  }), [volunteers]);

  const submitDecision = useCallback(async () => {
    if (!pendingDecision) return;
    const { volunteer, decision } = pendingDecision;
    setWorkingUid(volunteer.uid);
    try {
      await decideVolunteerVerification(profile, {
        volunteerId: volunteer.uid,
        volunteerName: volunteer.fullName,
        decision,
        note,
      });
      setPendingDecision(null);
      setNote('');
      await load();
    } catch {
      Alert.alert(
        decision === 'approved' ? 'Approval failed' : 'Rejection failed',
        'The verification decision could not be saved. Please try again.',
      );
    } finally {
      setWorkingUid(null);
    }
  }, [load, note, pendingDecision, profile]);

  const openHistory = useCallback(async (volunteer: VolunteerVerificationRow) => {
    try {
      setHistory({ volunteer, records: await getVolunteerVerificationHistory(profile, volunteer.uid) });
    } catch {
      Alert.alert('History unavailable', 'The verification history could not be loaded.');
    }
  }, [profile]);

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.centerHeading}>Administrators only</Text>
          <Text style={styles.centerText}>Volunteer verification decisions can only be made by an administrator account.</Text>
        </View>
      </SafeAreaView>
    );
  }

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
          <Text style={styles.centerHeading}>We couldn&apos;t load volunteer verifications.</Text>
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
        <Text style={styles.title}>Volunteer Verification</Text>
        <Text style={styles.subtitle}>Review volunteer profiles and record an approval decision.</Text>

        <View style={styles.tabs}>
          {TABS.map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === item.key }}
              style={[styles.tab, tab === item.key && styles.tabActive]}
              onPress={() => setTab(item.key)}
            >
              <Text style={[styles.tabText, tab === item.key && styles.tabTextActive]}>{item.label} ({counts[item.key]})</Text>
            </Pressable>
          ))}
        </View>

        {visible.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nothing here</Text>
            <Text style={styles.emptyBody}>
              {tab === 'pending' ? 'There are no volunteer verifications waiting for review.' : `No ${tab === 'verified' ? 'approved' : 'rejected'} volunteers yet.`}
            </Text>
          </View>
        ) : (
          <View style={styles.cards}>
            {visible.map((volunteer) => (
              <View key={volunteer.uid} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle}>{volunteer.fullName}</Text>
                  <View style={[styles.statusBadge, statusBadgeStyle(volunteer.verificationStatus)]}>
                    <Text style={[styles.statusBadgeText, statusTextStyle(volunteer.verificationStatus)]}>{STATUS_LABEL[volunteer.verificationStatus]}</Text>
                  </View>
                </View>
                {volunteer.email ? <Text style={styles.cardDetail}>{volunteer.email}</Text> : null}
                {volunteer.phone ? <Text style={styles.cardDetail}>{volunteer.phone}</Text> : null}
                {volunteer.locality ? <Text style={styles.cardDetail}>{volunteer.locality}</Text> : null}
                {volunteer.experience ? <Text style={styles.cardDetail}>Experience: {volunteer.experience}</Text> : null}
                {volunteer.bio ? <Text style={styles.cardDetail}>{volunteer.bio}</Text> : null}
                <Text style={styles.cardDetail}>Submitted {formatDate(volunteer.submittedAt)}</Text>
                {volunteer.decidedAt ? (
                  <Text style={styles.cardDetail}>
                    Decided {formatDate(volunteer.decidedAt)}{volunteer.decidedByName ? ` by ${volunteer.decidedByName}` : ''}
                  </Text>
                ) : null}
                {volunteer.decisionNote ? <Text style={styles.cardNote}>Note: {volunteer.decisionNote}</Text> : null}

                <View style={styles.actions}>
                  {volunteer.verificationStatus !== 'verified' ? (
                    <Pressable
                      accessibilityRole="button"
                      style={[styles.approveButton, workingUid === volunteer.uid && styles.buttonDisabled]}
                      disabled={workingUid === volunteer.uid}
                      onPress={() => { setNote(''); setPendingDecision({ volunteer, decision: 'approved' }); }}
                    >
                      <Text style={styles.approveButtonText}>Approve</Text>
                    </Pressable>
                  ) : null}
                  {volunteer.verificationStatus !== 'rejected' ? (
                    <Pressable
                      accessibilityRole="button"
                      style={[styles.rejectButton, workingUid === volunteer.uid && styles.buttonDisabled]}
                      disabled={workingUid === volunteer.uid}
                      onPress={() => { setNote(''); setPendingDecision({ volunteer, decision: 'rejected' }); }}
                    >
                      <Text style={styles.rejectButtonText}>Reject</Text>
                    </Pressable>
                  ) : null}
                </View>
                <Pressable accessibilityRole="button" style={styles.historyLink} onPress={() => void openHistory(volunteer)}>
                  <Text style={styles.historyLinkText}>View decision history</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={pendingDecision !== null} transparent animationType="fade" onRequestClose={() => setPendingDecision(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {pendingDecision?.decision === 'approved' ? 'Approve volunteer' : 'Reject volunteer'}
            </Text>
            <Text style={styles.modalBody}>
              {pendingDecision?.decision === 'approved'
                ? `${pendingDecision?.volunteer.fullName} will be marked verified and notified.`
                : `${pendingDecision?.volunteer.fullName} will be marked rejected and notified.`}
            </Text>
            <TextInput
              style={styles.noteInput}
              placeholder={pendingDecision?.decision === 'approved' ? 'Optional note for the record' : 'Reason shared with the volunteer'}
              placeholderTextColor={colors.inputPlaceholder}
              value={note}
              onChangeText={setNote}
              multiline
              accessibilityLabel="Decision note"
            />
            <View style={styles.modalActions}>
              <Pressable accessibilityRole="button" style={styles.modalCancel} onPress={() => setPendingDecision(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={[pendingDecision?.decision === 'approved' ? styles.approveButton : styles.rejectButtonSolid, styles.modalConfirm, workingUid !== null && styles.buttonDisabled]}
                disabled={workingUid !== null}
                onPress={() => void submitDecision()}
              >
                <Text style={pendingDecision?.decision === 'approved' ? styles.approveButtonText : styles.rejectButtonSolidText}>
                  {workingUid !== null ? 'Saving…' : 'Confirm'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={history !== null} transparent animationType="fade" onRequestClose={() => setHistory(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Decision history</Text>
            <Text style={styles.modalBody}>{history?.volunteer.fullName}</Text>
            {history?.records.length === 0 ? (
              <Text style={styles.cardDetail}>No verification decisions have been recorded yet.</Text>
            ) : (
              <ScrollView style={styles.historyList}>
                {history?.records.map((record) => (
                  <View key={record.id} style={styles.historyRow}>
                    <Text style={styles.historyDecision}>{record.decision === 'approved' ? 'Approved' : 'Rejected'}</Text>
                    <Text style={styles.cardDetail}>{formatDate(record.decidedAt)} by {record.adminName}</Text>
                    {record.note ? <Text style={styles.cardNote}>Note: {record.note}</Text> : null}
                  </View>
                ))}
              </ScrollView>
            )}
            <Pressable accessibilityRole="button" style={styles.modalCancel} onPress={() => setHistory(null)}>
              <Text style={styles.modalCancelText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function statusBadgeStyle(status: VolunteerVerificationStatus) {
  return status === 'verified' ? styles.badgeSuccess : status === 'rejected' ? styles.badgeError : styles.badgeWarning;
}

function statusTextStyle(status: VolunteerVerificationStatus) {
  return status === 'verified' ? styles.badgeSuccessText : status === 'rejected' ? styles.badgeErrorText : styles.badgeWarningText;
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
  subtitle: { fontSize: 15, lineHeight: 21, color: colors.textSecondary, marginTop: 4, marginBottom: 16 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  tabActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  tabText: { color: colors.textSecondary, fontSize: 13, fontWeight: '800' },
  tabTextActive: { color: colors.primaryDark },
  cards: { gap: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 17 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardTitle: { flex: 1, color: colors.textPrimary, fontSize: 16, lineHeight: 22, fontWeight: '800' },
  cardDetail: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 4 },
  cardNote: { color: colors.textPrimary, fontSize: 14, lineHeight: 20, marginTop: 6, fontStyle: 'italic' },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeText: { fontSize: 12, fontWeight: '800' },
  badgeWarning: { backgroundColor: colors.warningLight },
  badgeWarningText: { color: '#92400E' },
  badgeSuccess: { backgroundColor: colors.successLight },
  badgeSuccessText: { color: colors.success },
  badgeError: { backgroundColor: colors.errorLight },
  badgeErrorText: { color: colors.error },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  approveButton: { flex: 1, minHeight: 46, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  approveButtonText: { color: colors.textOnPrimary, fontSize: 14, fontWeight: '800' },
  rejectButton: { flex: 1, minHeight: 46, borderRadius: 12, borderWidth: 2, borderColor: colors.error, alignItems: 'center', justifyContent: 'center' },
  rejectButtonText: { color: colors.error, fontSize: 14, fontWeight: '800' },
  rejectButtonSolid: { flex: 1, minHeight: 46, borderRadius: 12, backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center' },
  rejectButtonSolidText: { color: colors.textOnPrimary, fontSize: 14, fontWeight: '800' },
  buttonDisabled: { opacity: 0.6 },
  historyLink: { minHeight: 44, justifyContent: 'center' },
  historyLinkText: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  emptyCard: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 20, alignItems: 'center' },
  emptyTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '800' },
  emptyBody: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 6, textAlign: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 22 },
  modalCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 20 },
  modalTitle: { color: colors.textPrimary, fontSize: 19, lineHeight: 25, fontWeight: '800' },
  modalBody: { color: colors.textSecondary, fontSize: 15, lineHeight: 21, marginTop: 8 },
  noteInput: { minHeight: 88, borderRadius: 12, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, padding: 12, marginTop: 14, color: colors.textPrimary, fontSize: 15, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalCancel: { flex: 1, minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  modalCancelText: { color: colors.textSecondary, fontSize: 14, fontWeight: '800' },
  modalConfirm: { marginTop: 10 },
  historyList: { maxHeight: 260, marginTop: 10 },
  historyRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 10 },
  historyDecision: { color: colors.textPrimary, fontSize: 15, fontWeight: '800' },
});
