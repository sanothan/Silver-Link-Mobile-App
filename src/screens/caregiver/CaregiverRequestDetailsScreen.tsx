import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { hasAcceptedCaregiverLink } from "../../services/caregiverLinkService";
import { getRequestById } from "../../services/requestService";
import { colors } from "../../theme/colors";
import {
    type CompanionshipRequest,
    REQUEST_STATUS_LABELS,
} from "../../types/request";

const STATUS_CHIP_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: "#DBEAFE", text: "#1E40AF" },
  accepted: { bg: "#DBEAFE", text: "#1E40AF" },
  scheduled: { bg: "#D1FAE5", text: "#065F46" },
  in_progress: { bg: "#FEF3C7", text: "#92400E" },
  completed: { bg: "#F3E8FF", text: "#5B21B6" },
  cancelled: { bg: "#FEE2E2", text: "#7F1D1D" },
};

export default function CaregiverRequestDetailsScreen() {
  const { id, elderlyUserId } = useLocalSearchParams<{
    id: string;
    elderlyUserId: string;
  }>();
  const router = useRouter();
  const { user } = useAuth();
  const [request, setRequest] = useState<CompanionshipRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const loadRequest = useCallback(async () => {
    if (!user || !id || !elderlyUserId) {
      setError("Missing required information.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setDenied(false);

    try {
      // Verify accepted link
      const hasAccepted = await hasAcceptedCaregiverLink(
        user.uid,
        elderlyUserId,
      );
      if (!hasAccepted) {
        setDenied(true);
        setLoading(false);
        return;
      }

      // Load request
      const fetchedRequest = await getRequestById(id, elderlyUserId);
      setRequest(fetchedRequest);
    } catch (err) {
      console.error("Error loading request:", err);
      setError(
        err instanceof Error ? err.message : "We couldn't load this request.",
      );
    } finally {
      setLoading(false);
    }
  }, [user, id, elderlyUserId]);

  useFocusEffect(
    useCallback(() => {
      loadRequest();
    }, [loadRequest]),
  );

  const handleRetry = () => {
    loadRequest();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Text style={styles.backButton}>← Back</Text>
            </Pressable>
            <Text style={styles.title}>Request Details</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (denied) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Text style={styles.backButton}>← Back</Text>
            </Pressable>
            <Text style={styles.title}>Request Details</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.centerContent}>
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateTitle}>Access Denied</Text>
              <Text style={styles.emptyStateMessage}>
                You don't have permission to view this request.
              </Text>
              <Pressable
                onPress={() => router.back()}
                accessibilityRole="button"
                style={styles.emptyStateButton}
              >
                <Text style={styles.emptyStateButtonText}>Go Back</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Text style={styles.backButton}>← Back</Text>
            </Pressable>
            <Text style={styles.title}>Request Details</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.centerContent}>
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateTitle}>
                We couldn't load this request.
              </Text>
              <Text style={styles.emptyStateMessage}>Please try again.</Text>
              <Pressable
                onPress={handleRetry}
                accessibilityRole="button"
                style={styles.emptyStateButton}
              >
                <Text style={styles.emptyStateButtonText}>Try Again</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!request) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Text style={styles.backButton}>← Back</Text>
            </Pressable>
            <Text style={styles.title}>Request Details</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.centerContent}>
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateTitle}>Request Not Found</Text>
              <Pressable
                onPress={() => router.back()}
                accessibilityRole="button"
                style={styles.emptyStateButton}
              >
                <Text style={styles.emptyStateButtonText}>Go Back</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const chipColor =
    STATUS_CHIP_COLORS[request.status] || STATUS_CHIP_COLORS.pending;
  const formattedDate = request.preferredDate
    ? new Date(request.preferredDate).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backButton}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>Request Details</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          scrollEnabled={true}
        >
          {/* Status Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Status</Text>
            <View
              style={[styles.statusChip, { backgroundColor: chipColor.bg }]}
            >
              <Text style={[styles.statusChipText, { color: chipColor.text }]}>
                {REQUEST_STATUS_LABELS[request.status]}
              </Text>
            </View>
          </View>

          {/* Request Information Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Request Information</Text>

            <View style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Activity Type</Text>
                <Text style={styles.cardValue}>{request.activityType}</Text>
              </View>

              {request.description && (
                <View style={styles.cardRow}>
                  <Text style={styles.cardLabel}>Description</Text>
                  <Text style={styles.cardValue}>{request.description}</Text>
                </View>
              )}

              {request.location && (
                <View style={styles.cardRow}>
                  <Text style={styles.cardLabel}>Location</Text>
                  <Text style={styles.cardValue}>{request.location}</Text>
                </View>
              )}

              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Date</Text>
                <Text style={styles.cardValue}>{formattedDate}</Text>
              </View>

              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Time</Text>
                <Text style={styles.cardValue}>{request.preferredTime}</Text>
              </View>

              {request.durationLabel && (
                <View style={styles.cardRow}>
                  <Text style={styles.cardLabel}>Duration</Text>
                  <Text style={styles.cardValue}>{request.durationLabel}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Volunteer Information (if assigned) */}
          {request.assignedVolunteerId && request.volunteerName && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Volunteer Information</Text>

              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <Text style={styles.cardLabel}>Name</Text>
                  <Text style={styles.cardValue}>{request.volunteerName}</Text>
                </View>

                {request.volunteerVerified && (
                  <View style={styles.cardRow}>
                    <Text style={styles.cardLabel}>Verification Status</Text>
                    <View style={styles.verifiedBadge}>
                      <Text style={styles.verifiedText}>✓ Verified</Text>
                    </View>
                  </View>
                )}

                {request.volunteerRating && (
                  <View style={styles.cardRow}>
                    <Text style={styles.cardLabel}>Rating</Text>
                    <Text style={styles.cardValue}>
                      {request.volunteerRating.toFixed(1)} / 5.0
                    </Text>
                  </View>
                )}

                {request.volunteerBio && (
                  <View style={styles.cardRow}>
                    <Text style={styles.cardLabel}>About</Text>
                    <Text style={styles.cardValue}>{request.volunteerBio}</Text>
                  </View>
                )}

                {request.volunteerExperience && (
                  <View style={styles.cardRow}>
                    <Text style={styles.cardLabel}>Experience</Text>
                    <Text style={styles.cardValue}>
                      {request.volunteerExperience}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Activity Timeline</Text>
            <View style={styles.card}>
              <TimelineRow label="Request Sent" date={request.createdAt} reached />
              <TimelineRow label="Volunteer Found" date={request.acceptedAt} reached={Boolean(request.acceptedAt)} />
              <TimelineRow label="Visit Scheduled" date={request.elderConfirmedAt} reached={Boolean(request.elderConfirmedAt)} />
              <TimelineRow label="Visit Started" date={request.startedAt} reached={Boolean(request.startedAt)} />
              {request.status === "cancelled" ? (
                <TimelineRow label="Cancelled" date={request.cancelledAt} reached />
              ) : (
                <TimelineRow label="Completed" date={request.completedAt} reached={request.status === "completed"} />
              )}
            </View>
          </View>

          {/* Metadata */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Details</Text>
            <View style={styles.card}>
              {request.createdAt && (
                <View style={styles.cardRow}>
                  <Text style={styles.cardLabel}>Created</Text>
                  <Text style={styles.cardValue}>
                    {request.createdAt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </Text>
                </View>
              )}
              {request.updatedAt && (
                <View style={styles.cardRow}>
                  <Text style={styles.cardLabel}>Last Updated</Text>
                  <Text style={styles.cardValue}>
                    {request.updatedAt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function TimelineRow({
  label,
  date,
  reached,
}: {
  label: string;
  date?: Date;
  reached: boolean;
}) {
  return (
    <View style={styles.timelineRow}>
      <Text style={[styles.timelineMark, reached && styles.timelineMarkReached]}>
        {reached ? "✓" : "○"}
      </Text>
      <View style={styles.timelineCopy}>
        <Text style={[styles.timelineLabel, reached && styles.timelineLabelReached]}>{label}</Text>
        {date ? <Text style={styles.timelineDate}>{date.toLocaleDateString()}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backButton: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.primary,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 24,
    paddingBottom: 32,
  },
  timelineRow: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  timelineMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    textAlign: "center",
    textAlignVertical: "center",
    color: colors.textMuted,
    backgroundColor: colors.surfaceSoft,
    fontSize: 16,
    fontWeight: "800",
  },
  timelineMarkReached: {
    color: colors.textOnPrimary,
    backgroundColor: colors.primary,
  },
  timelineCopy: { flex: 1 },
  timelineLabel: { color: colors.textMuted, fontSize: 15, fontWeight: "700" },
  timelineLabelReached: { color: colors.textPrimary },
  timelineDate: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 14,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  cardLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    flex: 0.4,
  },
  cardValue: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: "500",
    flex: 0.6,
    textAlign: "right",
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  statusChipText: {
    fontSize: 14,
    fontWeight: "700",
  },
  verifiedBadge: {
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  verifiedText: {
    color: "#065F46",
    fontSize: 13,
    fontWeight: "600",
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emptyStateContainer: {
    alignItems: "center",
    gap: 12,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
  },
  emptyStateMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  emptyStateButton: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  emptyStateButtonText: {
    color: colors.textOnPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
});
