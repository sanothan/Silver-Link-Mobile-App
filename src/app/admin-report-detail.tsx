import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCurrentViewer } from '../services/currentUser';
import { ReportAccessError, isAdmin } from '../services/reportAccess';
import type { ReportViewer } from '../services/reportAccess';
import { ReportNotFoundError, TriageValidationError, applyReportTriage, getReportForAdmin } from '../services/reportService';
import { RESOLUTION_NOTE_MAX_LENGTH, closesReport } from '../services/reportTriage';
import type { TriageField } from '../services/reportTriage';
import { colors } from '../theme/colors';
import { REPORT_CATEGORY_LABEL, REPORT_STATUS_LABEL, REPORT_TRIAGE_STATUSES } from '../types/report';
import type { ReportRecord, ReportStatus } from '../types/report';
import { formatRelativeTime } from '../utils/time';

type LoadState = 'loading' | 'ready' | 'denied' | 'missing' | 'error';

export default function AdminReportDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [state, setState] = useState<LoadState>('loading');
  const [viewer, setViewer] = useState<ReportViewer | null>(null);
  const [report, setReport] = useState<ReportRecord | null>(null);
  const [status, setStatus] = useState<ReportStatus>('open');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Partial<Record<TriageField, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(
    async (current: ReportViewer | null) => {
      if (!id) {
        setState('missing');
        return;
      }
      setState('loading');
      try {
        const found = await getReportForAdmin(current, id);
        setReport(found);
        setStatus(found.status);
        setNote(found.adminNote);
        setState('ready');
      } catch (error) {
        if (error instanceof ReportAccessError) setState('denied');
        else if (error instanceof ReportNotFoundError) setState('missing');
        else setState('error');
      }
    },
    [id],
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      const current = await getCurrentViewer();
      if (!active) return;
      setViewer(current);
      if (!isAdmin(current)) {
        setState('denied');
        return;
      }
      await load(current);
    })();
    return () => {
      active = false;
    };
  }, [load]);

  const save = useCallback(async () => {
    if (!report) return;
    setSaving(true);
    setSaved(false);
    setErrors({});
    try {
      const updated = await applyReportTriage(viewer, report, { status, note });
      setReport(updated);
      setNote(updated.adminNote);
      setSaved(true);
    } catch (error) {
      if (error instanceof TriageValidationError) setErrors(error.errors);
      else if (error instanceof ReportAccessError) setState('denied');
      else setErrors({ status: 'We could not save this update. Please try again.' });
    } finally {
      setSaving(false);
    }
  }, [note, report, status, viewer]);

  if (state === 'denied') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.centerHeading}>Administrators only</Text>
          <Text style={styles.centerText}>
            Safety reports contain private information about the people who filed them, so only
            administrators can review and update them.
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
          <Text style={styles.centerText}>Loading report...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (state === 'missing' || state === 'error' || !report) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.centerHeading}>
            {state === 'missing' ? 'This report is no longer available.' : 'We could not load this report.'}
          </Text>
          <Pressable accessibilityRole="button" style={styles.retryButton} onPress={() => router.back()}>
            <Text style={styles.retryText}>Back to reports</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const noteRequired = closesReport(status);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Pressable accessibilityRole="button" style={styles.backLink} onPress={() => router.back()}>
            <Text style={styles.backLinkText}>Back to reports</Text>
          </Pressable>

          <Text style={styles.title}>{REPORT_CATEGORY_LABEL[report.category]}</Text>
          <View style={styles.badgeRow}>
            <View style={styles.badgeNormal}>
              <Text style={styles.badgeTextNormal}>{REPORT_STATUS_LABEL[report.status]}</Text>
            </View>
            {report.urgent ? (
              <View style={styles.badgeUrgent}>
                <Text style={styles.badgeTextUrgent}>High priority</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Report details</Text>
            <DetailRow label="Filed" value={formatRelativeTime(report.createdAt)} />
            <DetailRow label="Reported by" value={`${report.reporterRole || 'member'} (${report.reporterId ?? 'identity withheld'})`} />
            <DetailRow
              label="About"
              value={
                report.subject.type === 'none'
                  ? 'No specific person or activity'
                  : `${report.subject.type === 'user' ? 'Member' : 'Activity'}: ${report.subject.label || report.subject.id}`
              }
            />
            {report.updatedAt ? (
              <DetailRow
                label="Last updated"
                value={`${formatRelativeTime(report.updatedAt)} by ${report.lastUpdatedBy ?? 'an administrator'}`}
              />
            ) : null}
            <Text style={styles.descriptionLabel}>What was reported</Text>
            <Text style={styles.description}>{report.description || 'No description provided.'}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Update status</Text>
            <Text style={styles.sectionHint}>
              Resolving or dismissing a report closes it, so a resolution note is required.
            </Text>

            <View style={styles.statusList}>
              {REPORT_TRIAGE_STATUSES.map((option) => {
                const selected = status === option.value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[styles.statusOption, selected && styles.statusOptionSelected]}
                    onPress={() => {
                      setStatus(option.value);
                      setSaved(false);
                      setErrors({});
                    }}
                  >
                    <Text style={[styles.statusLabel, selected && styles.statusLabelSelected]}>{option.label}</Text>
                    <Text style={styles.statusDescription}>{option.description}</Text>
                  </Pressable>
                );
              })}
            </View>
            {errors.status ? <Text style={styles.errorText}>{errors.status}</Text> : null}

            <Text style={styles.inputLabel}>Resolution notes{noteRequired ? '' : ' (optional)'}</Text>
            <TextInput
              style={[styles.input, errors.note && styles.inputError]}
              value={note}
              onChangeText={(value) => {
                setNote(value);
                setSaved(false);
              }}
              placeholder="Record what you found and what action was taken."
              placeholderTextColor={colors.inputPlaceholder}
              multiline
              maxLength={RESOLUTION_NOTE_MAX_LENGTH}
              accessibilityLabel="Resolution notes"
            />
            <Text style={styles.counter}>
              {note.trim().length}/{RESOLUTION_NOTE_MAX_LENGTH}
            </Text>
            {errors.note ? <Text style={styles.errorText}>{errors.note}</Text> : null}

            {saved ? <Text style={styles.successText}>Status change saved.</Text> : null}

            <Pressable
              accessibilityRole="button"
              style={[styles.primaryButton, saving && styles.buttonDisabled]}
              onPress={() => void save()}
              disabled={saving}
            >
              <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : 'Save update'}</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Status history</Text>
            {report.statusHistory.length === 0 ? (
              <Text style={styles.sectionHint}>No status changes recorded yet.</Text>
            ) : (
              <View style={styles.history}>
                {[...report.statusHistory].reverse().map((entry, index) => (
                  <View key={`${entry.changedAt?.getTime() ?? index}-${entry.status}`} style={styles.historyEntry}>
                    <Text style={styles.historyTitle}>
                      {REPORT_STATUS_LABEL[entry.previousStatus]} - {REPORT_STATUS_LABEL[entry.status]}
                    </Text>
                    <Text style={styles.historyMeta}>
                      {formatRelativeTime(entry.changedAt)} by {entry.changedBy || 'an administrator'}
                    </Text>
                    {entry.note ? <Text style={styles.historyNote}>{entry.note}</Text> : null}
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
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
    paddingHorizontal: 18,
    marginTop: 6,
  },
  retryText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '800' },
  backLink: { minHeight: 44, justifyContent: 'center' },
  backLinkText: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800', color: colors.textPrimary, marginTop: 4 },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 16 },
  badgeUrgent: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.error },
  badgeNormal: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.surfaceSoft },
  badgeTextUrgent: { fontSize: 12, fontWeight: '800', color: colors.textOnPrimary },
  badgeTextNormal: { fontSize: 12, fontWeight: '800', color: colors.textSecondary },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 17,
    marginBottom: 14,
  },
  sectionTitle: { color: colors.textPrimary, fontSize: 17, lineHeight: 23, fontWeight: '800' },
  sectionHint: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 6 },
  detailRow: { marginTop: 12 },
  detailLabel: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  detailValue: { color: colors.textPrimary, fontSize: 15, lineHeight: 21, marginTop: 2 },
  descriptionLabel: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, fontWeight: '700', marginTop: 14 },
  description: { color: colors.textPrimary, fontSize: 15, lineHeight: 22, marginTop: 4 },
  statusList: { gap: 10, marginTop: 14 },
  statusOption: {
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  statusOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  statusLabel: { color: colors.textPrimary, fontSize: 15, lineHeight: 21, fontWeight: '800' },
  statusLabelSelected: { color: colors.primary },
  statusDescription: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 2 },
  inputLabel: { color: colors.textPrimary, fontSize: 15, lineHeight: 21, fontWeight: '800', marginTop: 18 },
  input: {
    minHeight: 110,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.inputBackground,
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 21,
    padding: 14,
    marginTop: 8,
    textAlignVertical: 'top',
  },
  inputError: { borderColor: colors.error },
  counter: { color: colors.textMuted, fontSize: 12, textAlign: 'right', marginTop: 4 },
  errorText: { color: colors.error, fontSize: 14, lineHeight: 20, marginTop: 8 },
  successText: { color: colors.success, fontSize: 14, lineHeight: 20, fontWeight: '700', marginTop: 10 },
  primaryButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  primaryButtonText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '800' },
  buttonDisabled: { opacity: 0.6 },
  history: { gap: 12, marginTop: 12 },
  historyEntry: { borderLeftWidth: 3, borderLeftColor: colors.border, paddingLeft: 12 },
  historyTitle: { color: colors.textPrimary, fontSize: 15, lineHeight: 21, fontWeight: '800' },
  historyMeta: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 2 },
  historyNote: { color: colors.textPrimary, fontSize: 14, lineHeight: 20, marginTop: 6 },
});
