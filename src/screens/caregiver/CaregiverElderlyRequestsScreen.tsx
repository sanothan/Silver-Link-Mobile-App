import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { hasAcceptedCaregiverLink } from "../../services/caregiverLinkService";
import { getRequestsForLinkedElderlyUser } from "../../services/requestService";
import { getUserProfile } from "../../services/userService";
import { colors } from "../../theme/colors";
import {
    type CompanionshipRequest,
    REQUEST_STATUS_LABELS,
} from "../../types/request";

type FilterStatus = "all" | "active" | "history";

const STATUS_CHIP_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: "#DBEAFE", text: "#1E40AF" },
  accepted: { bg: "#DBEAFE", text: "#1E40AF" },
  scheduled: { bg: "#D1FAE5", text: "#065F46" },
  in_progress: { bg: "#FEF3C7", text: "#92400E" },
  completed: { bg: "#F3E8FF", text: "#5B21B6" },
  cancelled: { bg: "#FEE2E2", text: "#7F1D1D" },
};

export default function CaregiverElderlyRequestsScreen() {
  const { elderlyUserId } = useLocalSearchParams<{ elderlyUserId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [requests, setRequests] = useState<CompanionshipRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [linkedElderlyName, setLinkedElderlyName] = useState<string>("");

  const isActiveRequest = (req: CompanionshipRequest): boolean => {
    return ["pending", "accepted", "scheduled", "in_progress"].includes(
      req.status,
    );
  };

  const filteredRequests = requests.filter((req) => {
    if (filterStatus === "all") return true;
    if (filterStatus === "active") return isActiveRequest(req);
    if (filterStatus === "history")
      return ["completed", "cancelled"].includes(req.status);
    return true;
  });

  const loadRequests = useCallback(async () => {
    if (!user || !elderlyUserId) {
      setError("Missing required information.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Verify accepted link
      const hasAccepted = await hasAcceptedCaregiverLink(
        user.uid,
        elderlyUserId,
      );
      if (!hasAccepted) {
        setError("Access unavailable");
        setLoading(false);
        return;
      }

      // Get elderly name
      try {
        const profile = await getUserProfile(elderlyUserId);
        setLinkedElderlyName(profile?.fullName || "");
      } catch {
        // Profile not found, continue anyway
      }

      // Load requests
      const fetchedRequests =
        await getRequestsForLinkedElderlyUser(elderlyUserId);
      setRequests(fetchedRequests);
    } catch (err) {
      console.error("Error loading requests:", err);
      setError(
        err instanceof Error ? err.message : "We couldn't load the requests.",
      );
    } finally {
      setLoading(false);
    }
  }, [user, elderlyUserId]);

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [loadRequests]),
  );

  const handleRetry = () => {
    loadRequests();
  };

  const handleViewDetails = (requestId: string) => {
    router.push({
      pathname: "caregiver-request-details/[id]" as any,
      params: { id: requestId, elderlyUserId },
    });
  };

  const renderRequestCard = ({ item }: { item: CompanionshipRequest }) => {
    const chipColor =
      STATUS_CHIP_COLORS[item.status] || STATUS_CHIP_COLORS.pending;
    const formattedDate = item.preferredDate
      ? new Date(item.preferredDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      : "";
      const finalDate = item.status === "completed" ? item.completedAt : item.cancelledAt;
      const duration = item.durationLabel || (item.durationMinutes ? `${item.durationMinutes} minutes` : undefined);

    return (
      <Pressable
        onPress={() => handleViewDetails(item.id)}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.requestCard,
          pressed && styles.requestCardPressed,
        ]}
      >
        <View style={styles.requestCardContent}>
          <Text style={styles.activityType} numberOfLines={1}>
            {item.activityType}
          </Text>
          <Text style={styles.dateTime} numberOfLines={1}>
            {formattedDate} • {item.preferredTime}
          </Text>
          {duration ? <Text style={styles.detailText}>Duration: {duration}</Text> : null}

          {item.assignedVolunteerId && item.volunteerName && (
            <View style={styles.volunteerRow}>
              <Text style={styles.volunteerLabel}>Volunteer</Text>
              <Text style={styles.volunteerName}>{item.volunteerName}</Text>
              {item.volunteerVerified && (
                <Text style={styles.verifiedBadge}>✓</Text>
              )}
            </View>
          )}

          <View style={[styles.statusChip, { backgroundColor: chipColor.bg }]}>
            <Text
              style={[styles.statusChipText, { color: chipColor.text }]}
              numberOfLines={1}
            >
              {REQUEST_STATUS_LABELS[item.status]}
            </Text>
          </View>
          {finalDate ? (
            <Text style={styles.finalDate}>
              {item.status === "completed" ? "Completed" : "Cancelled"} on {finalDate.toLocaleDateString()}
            </Text>
          ) : null}
        </View>

        <Text style={styles.arrow}>→</Text>
      </Pressable>
    );
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
            <Text style={styles.title}>Activity Tracking</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (error === "Access unavailable") {
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
            <Text style={styles.title}>Activity Tracking</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.centerContent}>
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateTitle}>{error}</Text>
              <Text style={styles.emptyStateMessage}>
                You need an accepted caregiver connection before viewing this
                user's requests.
              </Text>
              <Pressable
                onPress={() => router.back()}
                accessibilityRole="button"
                style={styles.emptyStateButton}
              >
                <Text style={styles.emptyStateButtonText}>
                  Back to Dashboard
                </Text>
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
            <Text style={styles.title}>Activity Tracking</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.centerContent}>
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateTitle}>
                We couldn't load the requests.
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
          <Text style={styles.title}>Activity Tracking</Text>
          <View style={{ width: 40 }} />
        </View>

        {linkedElderlyName && (
          <Text style={styles.subtitle}>Requests from {linkedElderlyName}</Text>
        )}

        {filteredRequests.length > 0 && (
          <View style={styles.filterBar}>
            {(["all", "active", "history"] as const).map((filter) => (
              <Pressable
                key={filter}
                onPress={() => setFilterStatus(filter)}
                accessibilityRole="button"
                accessibilityState={{ selected: filterStatus === filter }}
                style={[
                  styles.filterButton,
                  filterStatus === filter && styles.filterButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    filterStatus === filter && styles.filterButtonTextActive,
                  ]}
                >
                  {filter === "all"
                    ? "All"
                    : filter === "active"
                      ? "Active"
                      : "History"}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {filteredRequests.length === 0 ? (
          <View style={styles.centerContent}>
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateTitle}>No requests yet</Text>
              <Text style={styles.emptyStateMessage}>
                {requests.length === 0
                  ? "This elderly user has not created any companionship requests."
                    : filterStatus === "active"
                      ? "No active activities found."
                      : "No completed or cancelled activities found."}
              </Text>
            </View>
          </View>
        ) : (
          <FlatList
            data={filteredRequests}
            renderItem={renderRequestCard}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            scrollEnabled={true}
            nestedScrollEnabled={true}
          />
        )}
      </View>
    </SafeAreaView>
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
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  filterBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#F1F5F9",
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  filterButtonTextActive: {
    color: colors.textOnPrimary,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    paddingBottom: 24,
  },
  requestCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  requestCardPressed: {
    backgroundColor: "#F8FAFC",
  },
  requestCardContent: {
    flex: 1,
    gap: 8,
    marginRight: 12,
  },
  activityType: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  dateTime: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  detailText: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  finalDate: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  volunteerRow: {
    gap: 4,
  },
  volunteerLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "600",
  },
  volunteerName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  verifiedBadge: {
    fontSize: 14,
    color: colors.success,
    marginLeft: 4,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  arrow: {
    fontSize: 18,
    color: colors.textSecondary,
    marginTop: 2,
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
