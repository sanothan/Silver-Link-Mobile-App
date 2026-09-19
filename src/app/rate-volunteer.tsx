import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCurrentViewer } from '../services/currentUser';
import type { ReportViewer } from '../services/reportAccess';
import { VolunteerRatingAccessError, canRateVolunteer } from '../services/volunteerRatingAccess';
import {
  VolunteerRatingValidationError,
  getMyRatingForActivity,
  getRateableActivities,
  getVolunteerRatingSummary,
  rateVolunteer,
} from '../services/volunteerRatingService';
import { formatRatingSummary } from '../services/volunteerRatingSummary';
import { RATING_COMMENT_MAX_LENGTH, validateVolunteerRatingDraft } from '../services/volunteerRatingValidation';
import type { VolunteerRatingField } from '../services/volunteerRatingValidation';
import { colors } from '../theme/Colors';
import type { ActivitySummary } from '../types/feedback';
import { VOLUNTEER_RATING_SCALE, emptyVolunteerRatingDraft } from '../types/volunteerRating';
import type { VolunteerRatingDraft, VolunteerRatingSummary } from '../types/volunteerRating';
import { formatRelativeTime } from '../utils/time';

type Phase = 'loading' | 'form' | 'submitting' | 'submitted' | 'signed-out' | 'nothing-to-rate';

export default function RateVolunteerScreen() {
  const router = useRouter();
  // Opening the screen from an activity preselects it; otherwise the person picks below.
  const { activityId } = useLocalSearchParams<{ activityId?: string }>();
  const [phase, setPhase] = useState<Phase>('loading');
  const [viewer, setViewer] = useState<ReportViewer | null>(null);
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [draft, setDraft] = useState<VolunteerRatingDraft>(emptyVolunteerRatingDraft());
  const [errors, setErrors] = useState<Partial<Record<VolunteerRatingField, string>>>({});
  const [submitError, setSubmitError] = useState('');
  const [alreadyRated, setAlreadyRated] = useState('');
  const [summary, setSummary] = useState<VolunteerRatingSummary | null>(null);

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

      // Only completed activities whose volunteer this person may rate are ever offered,
      // so an unrelated activity cannot be chosen in the first place.
      const rateable = await getRateableActivities(current);
      if (!active) return;
      setActivities(rateable);

      const preselected = rateable.find((activity) => activity.id === activityId);
      if (preselected) setDraft(emptyVolunteerRatingDraft(preselected.id));
      setPhase(rateable.length === 0 ? 'nothing-to-rate' : 'form');
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
      setSummary(null);

      const existing = await getMyRatingForActivity(viewer, activity.id);
      setAlreadyRated(existing ? canRateVolunteer(activity, viewer, existing).message : '');
      // The volunteer's standing so far, so the rater can see what they are adding to.
      if (activity.volunteerId) setSummary(await getVolunteerRatingSummary(activity.volunteerId));
    },
    [viewer],
  );

  const handleSubmit = useCallback(async () => {
    setSubmitError('');
    const result = validateVolunteerRatingDraft(draft);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setPhase('submitting');
    try {
      await rateVolunteer(draft, viewer);
      const activity = activities.find((item) => item.id === draft.activityId);
      if (activity?.volunteerId) setSummary(await getVolunteerRatingSummary(activity.volunteerId));
      setPhase('submitted');
    } catch (error) {
      if (error instanceof VolunteerRatingValidationError) {
        setErrors(error.errors);
      } else if (error instanceof VolunteerRatingAccessError) {
        // The service re-read the activity before writing, so this refusal is the
        // authoritative one and is worth showing in the person's own words.
        setSubmitError(error.message);
      } else {
        setSubmitError('We could not save your rating. Please check your connection and try again.');
      }
      setPhase('form');
    }
  }, [activities, draft, viewer]);

  const startAnother = useCallback(() => {
    setDraft(emptyVolunteerRatingDraft());
    setErrors({});
    setSubmitError('');
    setAlreadyRated('');
    setSummary(null);
    setPhase('form');
  }, []);

  if (phase === 'loading') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerText}>Finding volunteers you can rate...</Text>
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
            Sign in so your rating can be linked to the activity the volunteer helped you with.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'nothing-to-rate') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.centerHeading}>No volunteers to rate yet</Text>
          <Text style={styles.centerText}>
            Once a volunteer has completed an activity for you, you can come back here and say how they
            did.
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
          <Text style={styles.title}>Thank you for your rating</Text>
          <Text style={styles.lead}>
            Your rating helps other members find volunteers they can trust.
          </Text>
          {summary ? (
            <Text style={styles.summary}>This volunteer is now rated {formatRatingSummary(summary)}.</Text>
          ) : null}
          <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={startAnother}>
            <Text style={styles.primaryButtonText}>Rate another volunteer</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={styles.backLink}>Done</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const submitting = phase === 'submitting';
  const blocked = alreadyRated.length > 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Rate your volunteer</Text>
        <Text style={styles.lead}>
          Say how the volunteer did on a completed activity. Your rating is added to their overall score so
          trustworthy volunteers are recognised.
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
        {blocked ? <Text style={styles.notice}>{alreadyRated}</Text> : null}
        {summary && !blocked ? (
          <Text style={styles.summary}>Rated so far: {formatRatingSummary(summary)}</Text>
        ) : null}

        <Text style={styles.sectionLabel}>How did the volunteer do?</Text>
        <View style={styles.ratingRow}>
          {VOLUNTEER_RATING_SCALE.map((option) => {
            const selected = draft.score === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${option.value} out of 5, ${option.label}`}
                style={[styles.ratingOption, selected && styles.optionSelected]}
                onPress={() => {
                  setDraft((current) => ({ ...current, score: option.value }));
                  setErrors((current) => ({ ...current, score: undefined }));
                }}
              >
                <Text style={styles.ratingValue}>{option.value}</Text>
                <Text style={styles.ratingLabel}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {errors.score ? <Text style={styles.error}>{errors.score}</Text> : null}

        <Text style={styles.sectionLabel}>Anything to add? (optional)</Text>
        <TextInput
          style={[styles.input, errors.comment ? styles.inputError : null]}
          placeholder="What did this volunteer do well?"
          placeholderTextColor={colors.inputPlaceholder}
          value={draft.comment}
          onChangeText={(comment) => {
            setDraft((current) => ({ ...current, comment }));
            setErrors((current) => ({ ...current, comment: undefined }));
          }}
          multiline
          numberOfLines={4}
          maxLength={RATING_COMMENT_MAX_LENGTH}
          accessibilityLabel="Your comments about the volunteer"
        />
        <Text style={styles.counter}>
          {draft.comment.trim().length}/{RATING_COMMENT_MAX_LENGTH}
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
          <Text style={styles.primaryButtonText}>{submitting ? 'Saving...' : 'Save rating'}</Text>
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
    minHeight: 110,
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
  summary: { color: colors.textSecondary, fontSize: 15, lineHeight: 21, fontWeight: '700', marginTop: 10 },
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
