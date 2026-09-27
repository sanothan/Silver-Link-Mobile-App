import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppBackground, RequestHeader } from "../../../components/RequestFlowUI";
import { useAuth } from "../../../context/AuthContext";
import { getRequestById } from "../../../services/requestService";
import { getActivityReview, submitActivityReview } from "../../../services/reviewService";
import { colors } from "../../../theme/colors";
import type { CompanionshipRequest } from "../../../types/request";
import type { ActivityReview } from "../../../types/review";

export default function ActivityReviewScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [request, setRequest] = useState<CompanionshipRequest | null>(null);
  const [review, setReview] = useState<ActivityReview | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user || !requestId) return;
    setLoading(true);
    try {
      const activity = await getRequestById(requestId, user.uid);
      const existing = await getActivityReview(requestId, user.uid);
      setRequest(activity);
      setReview(existing);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load feedback.");
    } finally {
      setLoading(false);
    }
  }, [requestId, user]);

  useFocusEffect(useCallback(() => void load(), [load]));

  async function submit() {
    if (!user || !requestId || rating === 0) {
      setError("Please choose a star rating.");
      return;
    }
    setSaving(true);
    try {
      await submitActivityReview(requestId, user.uid, { rating, comment });
      await load();
      Alert.alert("Thank you", "Your feedback has been saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save feedback.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <AppBackground>
        <RequestHeader title="Activity Feedback" onBack={() => router.back()} />
        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {error && !request ? (
              <View style={styles.card}>
                <Text style={styles.heading}>Feedback unavailable</Text>
                <Text accessibilityRole="alert" style={styles.message}>{error}</Text>
                <Pressable accessibilityRole="button" style={styles.retryButton} onPress={() => void load()}>
                  <Text style={styles.retryButtonText}>Try Again</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.card}>
                  <Text style={styles.title}>{request?.activityType ?? "Activity"}</Text>
                  {request?.volunteerName ? <Text style={styles.subtitle}>Volunteer: {request.volunteerName}</Text> : null}
                </View>
                {review ? (
                  <View style={styles.card}>
                    <Text style={styles.submittedLabel}>✓ Feedback submitted</Text>
                    <Text style={styles.heading}>Your Review</Text>
                    <Text accessibilityLabel={`${review.rating} out of 5 stars`} style={styles.savedStars}>
                      {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                    </Text>
                    <Text style={styles.comment}>{review.comment || "No comment added."}</Text>
                  </View>
                ) : request?.status !== "completed" ? (
                  <View style={styles.card}><Text style={styles.message}>Feedback is available after this activity is completed.</Text></View>
                ) : (
                  <View style={styles.card}>
                    <Text style={styles.heading}>How was your experience?</Text>
                    <View style={styles.stars}>
                      {[1, 2, 3, 4, 5].map((value) => (
                        <Pressable key={value} accessibilityRole="radio" accessibilityLabel={`${value} stars`} accessibilityState={{ checked: rating === value }} style={styles.starButton} onPress={() => setRating(value)}>
                          <Text style={[styles.star, value <= rating && styles.starSelected]}>★</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={styles.label}>Comment (optional)</Text>
                    <TextInput value={comment} onChangeText={setComment} multiline maxLength={500} placeholder="Share what went well" placeholderTextColor={colors.inputPlaceholder} style={styles.input} />
                    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
                    <Pressable accessibilityRole="button" disabled={saving} style={[styles.button, saving && styles.disabled]} onPress={() => void submit()}>
                      {saving ? <ActivityIndicator color={colors.textOnPrimary} /> : <Text style={styles.buttonText}>Submit Review</Text>}
                    </Pressable>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        )}
      </AppBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 20, paddingBottom: 42, gap: 14 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 20 },
  title: { color: colors.textPrimary, fontSize: 25, lineHeight: 32, fontWeight: "900" },
  subtitle: { color: colors.textSecondary, fontSize: 17, marginTop: 7 },
  heading: { color: colors.textPrimary, fontSize: 21, fontWeight: "900" },
  stars: { flexDirection: "row", justifyContent: "space-between", marginVertical: 18 },
  starButton: { width: 52, height: 52, alignItems: "center", justifyContent: "center" },
  star: { color: colors.borderDark, fontSize: 38 },
  starSelected: { color: "#D97706" },
  savedStars: { color: "#D97706", fontSize: 34, marginTop: 14 },
  label: { color: colors.textPrimary, fontSize: 16, fontWeight: "800", marginBottom: 8 },
  input: { minHeight: 130, borderWidth: 1, borderColor: colors.borderDark, borderRadius: 14, padding: 14, color: colors.textPrimary, fontSize: 17, textAlignVertical: "top" },
  comment: { color: colors.textSecondary, fontSize: 17, lineHeight: 25, marginTop: 12 },
  message: { color: colors.textSecondary, fontSize: 17, lineHeight: 25 },
  submittedLabel: { color: colors.success, fontSize: 16, lineHeight: 23, fontWeight: "900", marginBottom: 8 },
  error: { color: colors.error, fontSize: 15, marginTop: 12 },
  button: { minHeight: 58, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: 18 },
  buttonText: { color: colors.textOnPrimary, fontSize: 17, fontWeight: "900" },
  disabled: { opacity: 0.6 },
  retryButton: { minHeight: 52, borderRadius: 14, borderWidth: 2, borderColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: 18 },
  retryButtonText: { color: colors.primary, fontSize: 17, fontWeight: "900" },
});
