import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCurrentViewer } from '../services/currentUser';
import type { ReportViewer } from '../services/reportAccess';
import { ReportValidationError, getReportSubjectOptions, submitReport } from '../services/reportService';
import {
  DESCRIPTION_MAX_LENGTH,
  DESCRIPTION_MIN_LENGTH,
  emptyDraft,
  validateReportDraft,
} from '../services/reportValidation';
import type { ReportField } from '../services/reportValidation';
import { colors } from '../theme/colors';
import { REPORT_CATEGORIES } from '../types/report';
import type { ReportCategory, ReportDraft, ReportSubjectOption } from '../types/report';

type Phase = 'loading' | 'form' | 'submitting' | 'submitted' | 'signed-out';

export default function ReportConcernScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('loading');
  const [viewer, setViewer] = useState<ReportViewer | null>(null);
  const [options, setOptions] = useState<ReportSubjectOption[]>([]);
  const [draft, setDraft] = useState<ReportDraft>(emptyDraft());
  const [errors, setErrors] = useState<Partial<Record<ReportField, string>>>({});
  const [submitError, setSubmitError] = useState('');
  const [reference, setReference] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      const current = await getCurrentViewer();
      if (!active) return;
      if (!current) {
        setPhase('signed-out');
        return;
      }
      setViewer(current);
      setPhase('form');
      const subjects = await getReportSubjectOptions(current);
      if (active) setOptions(subjects);
    })();
    return () => {
      active = false;
    };
  }, []);

  const subjectOptions = useMemo(
    () => [...options.filter((o) => o.type === 'user'), ...options.filter((o) => o.type === 'activity')],
    [options],
  );

  const selectCategory = useCallback((category: ReportCategory) => {
    setDraft((current) => ({ ...current, category }));
    setErrors((current) => ({ ...current, category: undefined }));
  }, []);

  const selectSubject = useCallback((option: ReportSubjectOption | null) => {
    setDraft((current) => ({
      ...current,
      subject: option
        ? { type: option.type, id: option.id, label: option.label }
        : { type: 'none', id: '', label: '' },
    }));
    setErrors((current) => ({ ...current, subject: undefined }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!viewer) return;
    setSubmitError('');
    const result = validateReportDraft(draft);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setPhase('submitting');
    try {
      const id = await submitReport(draft, viewer);
      setReference(id.slice(0, 8).toUpperCase());
      setPhase('submitted');
    } catch (error) {
      if (error instanceof ReportValidationError) {
        setErrors(error.errors);
      } else {
        setSubmitError('We could not send your report. Please check your connection and try again.');
      }
      setPhase('form');
    }
  }, [draft, viewer]);

  const startAnother = useCallback(() => {
    setDraft(emptyDraft());
    setErrors({});
    setReference('');
    setPhase('form');
  }, []);

  if (phase === 'loading') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerText}>Preparing the report form...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'signed-out') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.centerHeading}>Please sign in first</Text>
          <Text style={styles.centerText}>
            You need to be signed in so an administrator can follow up with you privately.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'submitted') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.confirmBadge}>
            <Text style={styles.confirmBadgeText}>OK</Text>
          </View>
          <Text style={styles.title}>Report submitted</Text>
          <Text style={styles.lead}>
            Your report is now open and an administrator will review it. Your name stays private - only
            administrators can see who filed a report.
          </Text>
          <View style={styles.referenceCard}>
            <Text style={styles.referenceLabel}>Reference</Text>
            <Text style={styles.referenceValue}>{reference}</Text>
          </View>
          <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={startAnother}>
            <Text style={styles.primaryButtonText}>Report something else</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={styles.backLink}>Done</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const submitting = phase === 'submitting';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Report a safety concern</Text>
        <Text style={styles.lead}>
          Tell us what happened. Reports go straight to SilverLink administrators, and your identity is
          never shown to the person you are reporting.
        </Text>

        <Text style={styles.sectionLabel}>What kind of concern is this?</Text>
        <View style={styles.categoryGrid}>
          {REPORT_CATEGORIES.map((category) => {
            const selected = draft.category === category.value;
            return (
              <Pressable
                key={category.value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[
                  styles.option,
                  selected && (category.urgent ? styles.optionSelectedUrgent : styles.optionSelected),
                ]}
                onPress={() => selectCategory(category.value)}
              >
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{category.label}</Text>
                {category.urgent ? <Text style={styles.urgentTag}>Urgent</Text> : null}
              </Pressable>
            );
          })}
        </View>
        {errors.category ? <Text style={styles.error}>{errors.category}</Text> : null}

        <Text style={styles.sectionLabel}>Who or what is this about?</Text>
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ selected: draft.subject.type === 'none' }}
          style={[styles.subjectRow, draft.subject.type === 'none' && styles.optionSelected]}
          onPress={() => selectSubject(null)}
        >
          <Text style={styles.subjectLabel}>Not about a specific person or activity</Text>
        </Pressable>
        {subjectOptions.length === 0 ? (
          <Text style={styles.hint}>
            No people or activities are available to link right now - you can still describe the concern below.
          </Text>
        ) : null}
        {subjectOptions.map((option) => {
          const selected = draft.subject.type === option.type && draft.subject.id === option.id;
          return (
            <Pressable
              key={`${option.type}:${option.id}`}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.subjectRow, selected && styles.optionSelected]}
              onPress={() => selectSubject(option)}
            >
              <Text style={styles.subjectLabel}>{option.label}</Text>
              <Text style={styles.subjectDetail}>
                {option.type === 'user' ? 'Member' : 'Activity'} - {option.detail}
              </Text>
            </Pressable>
          );
        })}
        {errors.subject ? <Text style={styles.error}>{errors.subject}</Text> : null}

        <Text style={styles.sectionLabel}>What happened?</Text>
        <TextInput
          style={[styles.input, errors.description ? styles.inputError : null]}
          placeholder="Describe the behaviour, when it happened, and anything else an administrator should know."
          placeholderTextColor={colors.inputPlaceholder}
          value={draft.description}
          onChangeText={(description) => {
            setDraft((current) => ({ ...current, description }));
            setErrors((current) => ({ ...current, description: undefined }));
          }}
          multiline
          numberOfLines={6}
          maxLength={DESCRIPTION_MAX_LENGTH}
          accessibilityLabel="Description of the concern"
        />
        <Text style={styles.counter}>
          {draft.description.trim().length}/{DESCRIPTION_MAX_LENGTH} - at least {DESCRIPTION_MIN_LENGTH} characters
        </Text>
        {errors.description ? <Text style={styles.error}>{errors.description}</Text> : null}

        {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

        <Pressable
          accessibilityRole="button"
          style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
          onPress={() => void handleSubmit()}
          disabled={submitting}
        >
          <Text style={styles.primaryButtonText}>{submitting ? 'Submitting...' : 'Submit report'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 22, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  centerText: { color: colors.textSecondary, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  centerHeading: { color: colors.textPrimary, fontSize: 20, lineHeight: 27, fontWeight: '800', textAlign: 'center' },
  title: { color: colors.textPrimary, fontSize: 26, lineHeight: 33, fontWeight: '800' },
  lead: { color: colors.textSecondary, fontSize: 16, lineHeight: 24, marginTop: 8 },
  sectionLabel: { color: colors.textPrimary, fontSize: 17, lineHeight: 24, fontWeight: '800', marginTop: 24 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  option: {
    minHeight: 56,
    minWidth: '46%',
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  optionSelectedUrgent: { borderColor: colors.error, backgroundColor: colors.errorLight },
  optionText: { color: colors.textSecondary, fontSize: 15, lineHeight: 20, fontWeight: '700', textAlign: 'center' },
  optionTextSelected: { color: colors.textPrimary },
  urgentTag: { color: colors.error, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  subjectRow: {
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 10,
  },
  subjectLabel: { color: colors.textPrimary, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  subjectDetail: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 2 },
  hint: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 10 },
  input: {
    minHeight: 150,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.inputBackground,
    color: colors.textPrimary,
    fontSize: 16,
    lineHeight: 23,
    padding: 14,
    marginTop: 12,
    textAlignVertical: 'top',
  },
  inputError: { borderColor: colors.error },
  counter: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: 6 },
  error: { color: colors.error, fontSize: 14, lineHeight: 20, fontWeight: '700', marginTop: 8 },
  primaryButton: {
    minHeight: 56,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 26,
  },
  primaryButtonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: colors.textOnPrimary, fontSize: 17, fontWeight: '800' },
  backLink: { color: colors.primary, fontSize: 16, fontWeight: '700', marginTop: 18, textAlign: 'center' },
  confirmBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 18,
  },
  confirmBadgeText: { color: colors.success, fontSize: 26, fontWeight: '800' },
  referenceCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 16,
    marginTop: 20,
    alignItems: 'center',
  },
  referenceLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  referenceValue: { color: colors.textPrimary, fontSize: 22, fontWeight: '800', marginTop: 4, letterSpacing: 1 },
});
