import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { logoutUser } from "../../services/authService";
import {
    cancelCaregiverLinkRequest,
    getCaregiverLinks,
} from "../../services/caregiverLinkService";
import { getNotifications } from "../../services/notificationService";
import { getRequestsForLinkedElderlyUser } from "../../services/requestService";
import { colors } from "../../theme/colors";
import type { CaregiverLinkDisplay } from "../../types/caregiver";
import type { CompanionshipRequest } from "../../types/request";
import { formatRelativeTime } from "../../utils/time";

type VisitStatus =
  | "Scheduled"
  | "Accepted"
  | "Arrived"
  | "In Progress"
  | "Completed"
  | "Cancelled";
type VerificationStatus = "Verified" | "Pending" | "Unverified";

type DashboardUpdate = {
  id: string;
  title: string;
  message: string;
  timeLabel: string;
};

type LinkedElderly = {
  id: string;
  name: string;
  relationship?: string;
  nextVisitLabel?: string;
};

type UpcomingVisit = {
  id: string;
  activityType: string;
  dateLabel: string;
  timeLabel: string;
  elderlyName: string;
  volunteerName: string;
  volunteerPhotoLabel?: string;
  verificationStatus: VerificationStatus;
  visitStatus: VisitStatus;
};

const NAV_ITEMS: {
  id: string;
  label: string;
  icon: string;
  active?: boolean;
}[] = [
  { id: "home", label: "Home", icon: "⌂", active: true },
  { id: "visits", label: "Visits", icon: "🗓" },
  { id: "messages", label: "Messages", icon: "💬" },
  { id: "alerts", label: "Alerts", icon: "⚠" },
  { id: "profile", label: "Profile", icon: "👤" },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

function getStatusStyle(status: VisitStatus) {
  switch (status) {
    case "Scheduled":
      return {
        container: styles.statusScheduled,
        text: styles.statusTextScheduled,
      };
    case "Accepted":
      return {
        container: styles.statusAccepted,
        text: styles.statusTextAccepted,
      };
    case "Arrived":
      return {
        container: styles.statusArrived,
        text: styles.statusTextArrived,
      };
    case "In Progress":
      return {
        container: styles.statusInProgress,
        text: styles.statusTextInProgress,
      };
    case "Completed":
      return {
        container: styles.statusCompleted,
        text: styles.statusTextCompleted,
      };
    case "Cancelled":
      return {
        container: styles.statusCancelled,
        text: styles.statusTextCancelled,
      };
    default:
      return {
        container: styles.statusScheduled,
        text: styles.statusTextScheduled,
      };
  }
}

function getVerificationStyle(status: VerificationStatus) {
  switch (status) {
    case "Verified":
      return {
        container: styles.verificationVerified,
        text: styles.verificationTextVerified,
      };
    case "Pending":
      return {
        container: styles.verificationPending,
        text: styles.verificationTextPending,
      };
    case "Unverified":
      return {
        container: styles.verificationUnverified,
        text: styles.verificationTextUnverified,
      };
    default:
      return {
        container: styles.verificationPending,
        text: styles.verificationTextPending,
      };
  }
}

function getLinkedElderly(
  links: CaregiverLinkDisplay[],
): LinkedElderly | null {
  const link = links.find((item) => item.status === "accepted");
  return link
    ? {
        id: link.elderlyUserId,
        name: link.elderlyName,
      }
    : null;
}

function getUpcomingVisit(
  requests: CompanionshipRequest[],
  elderlyName: string,
): UpcomingVisit | null {
  const request = requests
    .filter((item) => ["accepted", "scheduled", "in_progress"].includes(item.status))
    .sort(
      (a, b) =>
        (a.preferredDate?.getTime() ?? Number.MAX_SAFE_INTEGER) -
        (b.preferredDate?.getTime() ?? Number.MAX_SAFE_INTEGER),
    )[0];
  if (!request) return null;

  const visitStatus: VisitStatus =
    request.status === "accepted"
      ? "Accepted"
      : request.status === "scheduled"
        ? "Scheduled"
        : "In Progress";
  return {
    id: request.id,
    activityType: request.activityType,
    dateLabel: request.preferredDate.toLocaleDateString(),
    timeLabel: request.preferredTime,
    elderlyName,
    volunteerName: request.volunteerName ?? "Volunteer not assigned",
    volunteerPhotoLabel: request.volunteerName?.charAt(0).toUpperCase(),
    verificationStatus: request.volunteerVerified ? "Verified" : "Pending",
    visitStatus,
  };
}

async function loadRecentUpdates(uid: string): Promise<DashboardUpdate[]> {
  const notifications = await getNotifications(uid, 5);
  return notifications.map((item) => ({
    id: item.id,
    title: item.title,
    message: item.message,
    timeLabel: formatRelativeTime(item.createdAt),
  }));
}

function QuickActionCard({
  title,
  icon,
  onPress,
}: {
  title: string;
  icon: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      style={styles.quickActionCard}
      onPress={onPress}
    >
      <Text style={styles.quickActionIcon}>{icon}</Text>
      <Text style={styles.quickActionText}>{title}</Text>
    </Pressable>
  );
}

export default function CaregiverDashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updates, setUpdates] = useState<DashboardUpdate[]>([]);
  const [caregiverLinks, setCaregiverLinks] = useState<CaregiverLinkDisplay[]>(
    [],
  );
  const [linkedRequests, setLinkedRequests] = useState<CompanionshipRequest[]>(
    [],
  );
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadDashboard = async () => {
      setLoading(true);
      setError(null);

      try {
        const uid = user?.uid;
        if (!uid) return;

        // Load caregiver links
        const links = await getCaregiverLinks(uid);
        if (!isActive) return;
        setCaregiverLinks(links);

        const acceptedLink = links.find((link) => link.status === "accepted");
        if (acceptedLink) {
          const requests = await getRequestsForLinkedElderlyUser(
            acceptedLink.elderlyUserId,
          ).catch(() => []);
          if (!isActive) return;
          setLinkedRequests(requests);
        } else {
          setLinkedRequests([]);
        }

        // Load updates (notifications)
        const recent = await loadRecentUpdates(uid).catch(() => []);
        if (!isActive) return;
        setUpdates(recent);
      } catch (err) {
        if (!isActive) return;
        console.error("Dashboard error:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load dashboard",
        );
      } finally {
        if (!isActive) return;
        setLoading(false);
      }
    };

    void loadDashboard();

    return () => {
      isActive = false;
    };
  }, [user?.uid]);

  const caregiverName = useMemo(() => {
    const displayName = user?.displayName?.trim();
    if (displayName) {
      return displayName.split(/\s+/)[0];
    }
    return "Caregiver";
  }, [user?.displayName]);

  const linkedElderly = getLinkedElderly(caregiverLinks);
  const upcomingVisit = linkedElderly
    ? getUpcomingVisit(linkedRequests, linkedElderly.name)
    : null;

  const handleLinkElderly = () => {
    router.push("/link-elderly" as any);
  };

  const handleCancelRequest = (linkId: string, elderlyName: string) => {
    Alert.alert(
      "Cancel connection request?",
      `The connection request to ${elderlyName} will be cancelled.`,
      [
        { text: "Keep Request", style: "cancel" },
        {
          text: "Cancel Request",
          style: "destructive",
          onPress: async () => {
            if (!user?.uid) return;
            setCancelling(linkId);
            try {
              await cancelCaregiverLinkRequest(linkId, user.uid);
              setCaregiverLinks((prev) =>
                prev.filter((link) => link.id !== linkId),
              );
            } catch (err) {
              Alert.alert(
                "Error",
                err instanceof Error
                  ? err.message
                  : "Could not cancel request.",
              );
            } finally {
              setCancelling(null);
            }
          },
        },
      ],
    );
  };

  const handleViewRequests = (elderlyUserId: string) => {
    router.push({
      pathname: "caregiver-elderly-requests" as any,
      params: { elderlyUserId },
    });
  };

  const handleViewRequestDetails = (requestId: string, elderlyUserId: string) => {
    router.push({
      pathname: "caregiver-request-details/[id]" as any,
      params: { id: requestId, elderlyUserId },
    });
  };

  const handleViewTrustedContact = (elderlyUserId: string) => {
    router.push({
      pathname: "caregiver-trusted-contact" as any,
      params: { elderlyUserId },
    });
  };

  const handleViewVisits = () => {
    const linked = caregiverLinks.find((link) => link.status === "accepted");
    if (linked) {
      handleViewRequests(linked.elderlyUserId);
    } else {
      Alert.alert("No linked elderly user", "Connect with an elderly user to view activity tracking.");
    }
  };

  const handleMessage = () => {
    const linked = caregiverLinks.find((link) => link.status === "accepted");
    const request = linkedRequests.find(
      (item) => linked && item.assignedVolunteerId && ["accepted", "scheduled", "in_progress"].includes(item.status),
    );
    if (!linked || !request) {
      Alert.alert("No active conversation", "Messaging is available after a volunteer accepts a linked activity.");
      return;
    }
    router.push({
      pathname: "caregiver-volunteer-chat/[id]" as any,
      params: { id: request.id, elderlyUserId: linked.elderlyUserId },
    });
  };

  const handleDashboardNavigation = (id: string) => {
    switch (id) {
      case "home":
        router.replace("/home" as any);
        break;
      case "visits":
        handleViewVisits();
        break;
      case "messages":
        handleMessage();
        break;
      case "alerts":
        router.push("/caregiver-notifications" as any);
        break;
      case "profile":
        router.push("/caregiver-profile" as any);
        break;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading your dashboard…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>
            We couldn&apos;t load your dashboard information.
          </Text>
          <Text style={styles.errorText}>Please try again.</Text>
          <Pressable
            accessibilityRole="button"
            style={styles.retryButton}
            onPress={() => setError(null)}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <View style={styles.headerRow}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.greeting}>
                {getGreeting()}, {caregiverName}
              </Text>
              <Text style={styles.subtitle}>
                Here&apos;s how your loved one is doing today.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Log out"
              style={styles.notificationButton}
              onPress={logoutUser}
            >
              <Text style={styles.logoutText}>Exit</Text>
            </Pressable>
          </View>

          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>Your Loved One</Text>
            {linkedElderly ? (
              <View style={styles.card}>
                <View style={styles.lovedOneHeader}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>
                      {linkedElderly.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.lovedOneMeta}>
                    <Text style={styles.lovedOneName}>
                      {linkedElderly.name}
                    </Text>
                    {linkedElderly.relationship ? (
                      <Text style={styles.mutedText}>
                        {linkedElderly.relationship}
                      </Text>
                    ) : null}
                    <Text style={styles.lovedOneSummary}>
                      {linkedElderly.nextVisitLabel ??
                        "Next visit: To be scheduled"}
                    </Text>
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  style={styles.inlineAction}
                  onPress={() => handleViewRequests(linkedElderly.id)}
                >
                  <Text style={styles.inlineActionText}>View Details</Text>
                  <Text style={styles.inlineActionArrow}>→</Text>
                </Pressable>
              </View>
            ) : caregiverLinks.length > 0 ? (
              <View>
                {caregiverLinks.map((link) => {
                  const isPending = link.status === "pending";
                  return (
                    <View
                      key={link.id}
                      style={[styles.card, { marginBottom: 12 }]}
                    >
                      <View style={styles.lovedOneHeader}>
                        <View style={styles.avatarCircle}>
                          <Text style={styles.avatarText}>
                            {link.elderlyName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.lovedOneMeta}>
                          <Text style={styles.lovedOneName}>
                            {link.elderlyName}
                          </Text>
                          <View style={styles.statusBadgeRow}>
                            <View
                              style={[
                                styles.statusBadge,
                                isPending
                                  ? styles.statusPendingBadge
                                  : styles.statusAcceptedBadge,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.statusBadgeSmallText,
                                  isPending
                                    ? styles.statusPendingText
                                    : styles.statusAcceptedText,
                                ]}
                              >
                                {isPending
                                  ? "Waiting for Confirmation"
                                  : "Connected"}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                      <View style={styles.linkActionRow}>
                        {isPending ? (
                          <Pressable
                            accessibilityRole="button"
                            disabled={cancelling === link.id}
                            onPress={() =>
                              handleCancelRequest(link.id, link.elderlyName)
                            }
                            style={[
                              styles.inlineAction,
                              styles.inlineActionDanger,
                            ]}
                          >
                            <Text
                              style={[
                                styles.inlineActionText,
                                styles.inlineActionTextDanger,
                                cancelling === link.id && { opacity: 0.5 },
                              ]}
                            >
                              {cancelling === link.id
                                ? "Cancelling..."
                                : "Cancel"}
                            </Text>
                          </Pressable>
                        ) : (
                          <>
                            <Pressable
                              accessibilityRole="button"
                              onPress={() =>
                                handleViewRequests(link.elderlyUserId)
                              }
                              style={styles.inlineAction}
                            >
                              <Text style={styles.inlineActionText}>
                                View Requests
                              </Text>
                              <Text style={styles.inlineActionArrow}>→</Text>
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              onPress={() => handleViewTrustedContact(link.elderlyUserId)}
                              style={styles.inlineAction}
                            >
                              <Text style={styles.inlineActionText}>
                                Trusted Contact
                              </Text>
                              <Text style={styles.inlineActionArrow}>→</Text>
                            </Pressable>
                          </>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  Connect with your loved one
                </Text>
                <Text style={styles.cardText}>
                  Send a connection request to an elderly family member. They
                  must confirm the request before the connection becomes active.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  style={styles.primaryButton}
                  onPress={handleLinkElderly}
                >
                  <Text style={styles.primaryButtonText}>
                    Link Elderly User
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>Upcoming Visit</Text>
            {upcomingVisit ? (
              <View style={styles.card}>
                <Text style={styles.visitTitle}>
                  {upcomingVisit.activityType}
                </Text>
                <Text style={styles.visitMeta}>
                  {upcomingVisit.dateLabel} • {upcomingVisit.timeLabel}
                </Text>
                <View style={styles.volunteerRow}>
                  <View style={styles.volunteerAvatar}>
                    <Text style={styles.volunteerAvatarText}>
                      {upcomingVisit.volunteerPhotoLabel ?? "V"}
                    </Text>
                  </View>
                  <View style={styles.volunteerMeta}>
                    <Text style={styles.mutedLabel}>Volunteer</Text>
                    <Text style={styles.volunteerName}>
                      {upcomingVisit.volunteerName}
                    </Text>
                  </View>
                </View>
                <View style={styles.badgeRow}>
                  <View
                    style={[
                      styles.verificationBadge,
                      getVerificationStyle(upcomingVisit.verificationStatus)
                        .container,
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        getVerificationStyle(upcomingVisit.verificationStatus)
                          .text,
                      ]}
                    >
                      {upcomingVisit.verificationStatus === "Verified"
                        ? "✓ Verified"
                        : upcomingVisit.verificationStatus}
                    </Text>
                  </View>
                </View>
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Status:</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      getStatusStyle(upcomingVisit.visitStatus).container,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        getStatusStyle(upcomingVisit.visitStatus).text,
                      ]}
                    >
                      {upcomingVisit.visitStatus}
                    </Text>
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  style={styles.inlineAction}
                  onPress={() =>
                    handleViewRequestDetails(
                      upcomingVisit.id,
                      caregiverLinks.find((link) => link.status === "accepted")
                        ?.elderlyUserId ?? "",
                    )
                  }
                >
                  <Text style={styles.inlineActionText}>View Visit</Text>
                  <Text style={styles.inlineActionArrow}>→</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.card}>
                <Text style={styles.emptyTitle}>No upcoming visits</Text>
                <Text style={styles.emptyText}>
                  Scheduled companionship visits will appear here.
                </Text>
              </View>
            )}
          </View>

          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.quickActionGrid}>
              <QuickActionCard
                title="Visits"
                icon="🗓"
                onPress={handleViewVisits}
              />
              <QuickActionCard
                title="Message"
                icon="💬"
                onPress={handleMessage}
              />
              <QuickActionCard
                title="Loved One"
                icon="👨‍🦳"
                onPress={() => {
                  const linked = caregiverLinks.find(
                    (link) => link.status === "accepted",
                  );
                  if (linked) handleViewTrustedContact(linked.elderlyUserId);
                  else handleLinkElderly();
                }}
              />
              <QuickActionCard
                title="Report Concern"
                icon="⚠"
                onPress={() => router.push("/report-concern" as any)}
              />
            </View>
          </View>

          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>Recent Updates</Text>
            {updates.length > 0 ? (
              <View style={styles.updatesList}>
                {updates.map((update) => (
                  <View key={update.id} style={styles.updateItem}>
                    <View style={styles.updateDot} />
                    <View style={styles.updateTextWrap}>
                      <Text style={styles.updateTitle}>{update.title}</Text>
                      <Text style={styles.updateMessage}>{update.message}</Text>
                      <Text style={styles.updateMeta}>{update.timeLabel}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.card}>
                <Text style={styles.emptyTitle}>No updates yet.</Text>
                <Text style={styles.emptyText}>
                  Important visit updates will appear here.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        <View style={styles.bottomNav}>
          {NAV_ITEMS.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              style={[styles.navItem, item.active && styles.navItemActive]}
              onPress={() => handleDashboardNavigation(item.id)}
            >
              <Text
                style={[styles.navIcon, item.active && styles.navIconActive]}
              >
                {item.icon}
              </Text>
              <Text
                style={[styles.navLabel, item.active && styles.navLabelActive]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 100,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  headerTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  greeting: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    color: colors.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  notificationButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  notificationIcon: {
    fontSize: 20,
  },
  logoutText: { color: colors.primary, fontSize: 14, fontWeight: "800" },
  sectionWrap: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 10,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: colors.textPrimary,
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    marginBottom: 14,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  primaryButtonText: {
    color: colors.textOnPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  lovedOneHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.primary,
  },
  lovedOneMeta: {
    flex: 1,
  },
  lovedOneName: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  lovedOneSummary: {
    marginTop: 4,
    fontSize: 14,
    color: colors.textSecondary,
  },
  mutedText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  inlineAction: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  inlineActionText: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 15,
  },
  inlineActionArrow: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 18,
    marginLeft: 4,
  },
  visitTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  visitMeta: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 18,
  },
  volunteerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  volunteerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.infoLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  volunteerAvatarText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.info,
  },
  volunteerMeta: {
    flex: 1,
  },
  mutedLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  volunteerName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: 2,
  },
  badgeRow: {
    marginBottom: 12,
  },
  verificationBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  verificationVerified: { backgroundColor: colors.successLight },
  verificationPending: { backgroundColor: colors.warningLight },
  verificationUnverified: { backgroundColor: colors.errorLight },
  verificationTextVerified: { color: colors.success, fontWeight: "700" },
  verificationTextPending: { color: colors.warning, fontWeight: "700" },
  verificationTextUnverified: { color: colors.error, fontWeight: "700" },
  badgeText: {
    fontSize: 12,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  statusLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusScheduled: { backgroundColor: colors.primaryLight },
  statusAccepted: { backgroundColor: colors.infoLight },
  statusArrived: { backgroundColor: colors.warningLight },
  statusInProgress: { backgroundColor: colors.primaryLight },
  statusCompleted: { backgroundColor: colors.successLight },
  statusCancelled: { backgroundColor: colors.errorLight },
  statusTextScheduled: { color: colors.primary, fontWeight: "700" },
  statusTextAccepted: { color: colors.info, fontWeight: "700" },
  statusTextArrived: { color: colors.warning, fontWeight: "700" },
  statusTextInProgress: { color: colors.primary, fontWeight: "700" },
  statusTextCompleted: { color: colors.success, fontWeight: "700" },
  statusTextCancelled: { color: colors.error, fontWeight: "700" },
  statusBadgeText: {
    fontSize: 12,
  },
  quickActionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  quickActionCard: {
    width: "48%",
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 110,
    shadowColor: colors.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  quickActionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
  },
  updatesList: {
    gap: 12,
  },
  updateItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  updateDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginTop: 6,
    marginRight: 12,
  },
  updateTextWrap: {
    flex: 1,
  },
  updateTitle: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: "600",
    marginBottom: 4,
  },
  updateMessage: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  updateMeta: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  bottomNav: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 12,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    borderRadius: 12,
    paddingVertical: 4,
  },
  navItemActive: {
    backgroundColor: colors.primaryLight,
  },
  navIcon: {
    fontSize: 18,
    marginBottom: 2,
    color: colors.textSecondary,
  },
  navIconActive: {
    color: colors.primary,
  },
  navLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  navLabelActive: {
    color: colors.primary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    backgroundColor: colors.background,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: 10,
  },
  errorText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 18,
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    minHeight: 48,
    minWidth: 150,
    alignItems: "center",
    justifyContent: "center",
  },
  retryButtonText: {
    color: colors.textOnPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  statusBadgeRow: {
    marginTop: 6,
  },
  statusPendingBadge: {
    backgroundColor: colors.warningLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusAcceptedBadge: {
    backgroundColor: colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeSmallText: {
    fontSize: 12,
    fontWeight: "700",
  },
  statusPendingText: {
    color: colors.warning,
  },
  statusAcceptedText: {
    color: colors.success,
  },
  linkActionRow: {
    gap: 10,
  },
  inlineActionDanger: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 12,
    marginTop: 12,
  },
  inlineActionTextDanger: {
    color: colors.error,
  },
});
