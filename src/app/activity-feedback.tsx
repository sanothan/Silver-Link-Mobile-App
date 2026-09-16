import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCurrentViewer } from '../services/currentUser';
import { FeedbackAccessError, canSubmitFeedback } from '../services/feedbackAccess';
import {
  FeedbackValidationError,
  getFeedbackEligibleActivities,
  getMyFeedbackForActivity,
  submitActivityFeedback,
} from '../services/feedbackService';
import {
  COMMENT_MAX_LENGTH,
  COMMENT_MIN_LENGTH,
  emptyFeedbackDraft,
  validateFeedbackDraft,
} from '../services/feedbackValidation';
import type { FeedbackField } from '../services/feedbackValidation';
import type { ReportViewer } from '../services/reportAccess';
import { colors } from '../theme/Colors';
import { RATING_OPTIONS } from '../types/feedback';
import type { ActivitySummary, FeedbackDraft } from '../types/feedback';
import { formatRelativeTime } from '../utils/time';

type Phase = 'loading' | 'form' | 'submitting' | 'submitted' | 'signed-out' | 'nothing-to-review';

export default function ActivityFeedbackScreen() {
  const router = useRouter();
  // Opening the screen from an activity preselects it; otherwise the person picks below.
  const { activityId } = useLocalSearchParams<{ activityId?: string }>();
  const [phase, setPhase] = useState<Phase>('loading');
  const [viewer, setViewer] = useState<ReportViewer | null>(null);
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [draft, setDraft] = useState<FeedbackDraft>(emptyFeedbackDraft());
  const [errors, setErrors] = useState<Partial<Record<FeedbackField, string>>>({});
  const [submitError, setSubmitError] = useState('');
  const [alreadyReviewed, setAlreadyReviewed] = useState('');

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

      // Only completed activities the viewer took part in are ever offered, so an
      // unrelated activity cannot be chosen in the first place.
      const eligible = await getFeedbackEligibleActivities(current);
      if (!active) return;
      setActivities(eligible);

      const preselected = eligible.find((activity) => activity.id === activityId);
      if (preselected) setDraft(emptyFeedbackDraft(preselected.id));
      setPhase(eligible.length === 0 ? 'nothing-to-review' : 'form');
    })();
    return () => {
      active = false;
    };
  }, [activityId]);

  const selectActivity = useCallback(
    async (activity: ActivitySummary) => {
      setDraft((current) => ({ ...current, activityId: activity.id }));
      setErrors((current) => ({ ...current, activity: undefined }));
      setSubmitError('');
      const existing = await getMyFeedbackForActivity(viewer, activity.id);
      setAlreadyReviewed(existing ? canSubmitFeedback(activity, viewer, existing).message : '');
    },
    [viewer],
  );

  const handleSubmit = useCallback(async () => {
    setSubmitError('');
    const result = validateFeedbackDraft(draft);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setPhase('submitting');
    try {
      await submitActivityFeedback(draft, viewer);
      setPhase('submitted');
    } catch (error) {
      if (error instanceof FeedbackValidationError) {
        setErrors(error.errors);
      } else if (error instanceof FeedbackAccessError) {
        // The service re-read the activity before writing, so this refusal is the
        // authoritative one and is worth showing in the person's own words.
        setSubmitError(error.message);
      } else {
        setSubmitError('We could not send your feedback. Please check your connection and try again.');
      }
      setPhase('form');
    }
  }, [draft, viewer]);

  const startAnother = useCallback(() => {
    setDraft(emptyFeedbackDraft());
    setErrors({});
    setSubmitError('');
    setAlreadyReviewed('');
    setPhase('form');
  }, []);

  if (phase === 'loading') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerText}>Finding your completed activities...</Text>
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
            Sign in so your feedback can be linked to the activity you took part in.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'nothing-to-review') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.centerHeading}>No completed activities yet</Text>
          <Text style={styles.centerText}>
            Once an activity you took part in is marked as completed, you can come back here and tell us
            how it went.
          </Text>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={styles.backLink}>Go back</Text>
          </Pressable>
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
          <Text style={styles.title}>Thank you for your feedback</Text>
          <Text style={styles.lead}>
            Your comments are saved against this activity, and SilverLink uses them to improve the service.
          </Text>
          <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={startAnother}>
            <Text style={styles.primaryButtonText}>Review another activity</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={styles.backLink}>Done</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const submitting = phase === 'submitting';
  const blocked = alreadyReviewed.length > 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>How did it go?</Text>
        <Text style={styles.lead}>
          Tell us about a completed activity. Your feedback is linked to that activity and helps SilverLink
          improve the service.
        </Text>

        <Text style={styles.sectionLabel}>Which activity is this about?</Text>
        {activities.map((activity) => {
          const selected = draft.activityId === activity.id;
          return (
            <Pressable
              key={activity.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.activityRow, selected && styles.optionSelected]}
              onPress={() => void selectActivity(activity)}
            >
              <Text style={styles.activityTitle}>{activity.title}</Text>
              <Text style={styles.activityDetail}>
                Completed {formatRelativeTime(activity.completedAt ?? activity.createdAt).toLowerCase()}
              </Text>
            </Pressable>
          );
        })}
        {errors.activity ? <Text style={styles.error}>{errors.activity}</Text> : null}
        {blocked ? <Text style={styles.notice}>{alreadyReviewed}</Text> : null}

        <Text style={styles.sectionLabel}>How would you rate it? (optional)</Text>
        <View style={styles.ratingRow}>
          {RATING_OPTIONS.map((option) => {
            const selected = draft.rating === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${option.value} out of 5, ${option.label}`}
                style={[styles.ratingOption, selected && styles.optionSelected]}
                onPress={() =>
                  setDraft((current) => ({
                    ...current,
                    rating: current.rating === option.value ? null : option.value,
                  }))
                }
              >
                <Text style={styles.ratingValue}>{option.value}</Text>
                <Text style={styles.ratingLabel}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {errors.rating ? <Text style={styles.error}>{errors.rating}</Text> : null}

        <Text style={styles.sectionLabel}>Your comments</Text>
        <TextInput
          style={[styles.input, errors.comment ? styles.inputError : null]}
          placeholder="What went well, and what could SilverLink do better next time?"
          placeholderTextColor={colors.inputPlaceholder}
          value={draft.comment}
          onChangeText={(comment) => {
            setDraft((current) => ({ ...current, comment }));
            setErrors((current) => ({ ...current, comment: undefined }));
          }}
          multiline
          numberOfLines={6}
          maxLength={COMMENT_MAX_LENGTH}
          accessibilityLabel="Your feedback comments"
        />
        <Text style={styles.counter}>
          {draft.comment.trim().length}/{COMMENT_MAX_LENGTH} - at least {COMMENT_MIN_LENGTH} characters
        </Text>
        {errors.comment ? <Text style={styles.error}>{errors.comment}</Text> : null}

        {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: submitting || blocked }}
          style={[styles.primaryButton, (submitting || blocked) && styles.primaryButtonDisabled]}
          onPress={() => void handleSubmit()}
          disabled={submitting || blocked}
        >
          <Text style={styles.primaryButtonText}>{submitting ? 'Sending...' : 'Send feedback'}</Text>
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
  activityRow: {
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
  activityTitle: { color: colors.textPrimary, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  activityDetail: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 2 },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  ratingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  ratingOption: {
    minHeight: 56,
    minWidth: '30%',
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  ratingValue: { color: colors.textPrimary, fontSize: 20, lineHeight: 26, fontWeight: '800' },
  ratingLabel: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, fontWeight: '700' },
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
  notice: { color: colors.textSecondary, fontSize: 15, lineHeight: 21, fontWeight: '700', marginTop: 10 },
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
});
