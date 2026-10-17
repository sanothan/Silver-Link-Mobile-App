import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RequestHeader } from "../../components/RequestFlowUI";
import { useAuth } from "../../context/AuthContext";
import { getCaregiverLinks } from "../../services/caregiverLinkService";
import { getRequestsForLinkedElderlyUser } from "../../services/requestService";
import { colors } from "../../theme/colors";
import { canChatForStatus } from "../../types/chat";
import { REQUEST_STATUS_LABELS, type CompanionshipRequest } from "../../types/request";

type CaregiverConversation = {
  request: CompanionshipRequest;
  elderlyUserId: string;
  elderlyName: string;
};

export default function CaregiverMessagesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<CaregiverConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setConversations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(false);
    try {
      const links = await getCaregiverLinks(user.uid);
      const acceptedLinks = links.filter((link) => link.status === "accepted");
      const linkedConversations = await Promise.all(
        acceptedLinks.map(async (link) => {
          const requests = await getRequestsForLinkedElderlyUser(link.elderlyUserId);
          return requests
            .filter(
              (request) =>
                canChatForStatus(request.status) &&
                Boolean(request.assignedVolunteerId),
            )
            .map((request) => ({
              request,
              elderlyUserId: link.elderlyUserId,
              elderlyName: link.elderlyName,
            }));
        }),
      );
      setConversations(
        linkedConversations
          .flat()
          .sort(
            (a, b) =>
              a.request.preferredDate.getTime() - b.request.preferredDate.getTime(),
          ),
      );
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const openConversation = (conversation: CaregiverConversation) => {
    router.push({
      pathname: "/caregiver-volunteer-chat/[id]" as any,
      params: {
        id: conversation.request.id,
        elderlyUserId: conversation.elderlyUserId,
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <RequestHeader title="Messages" onBack={() => router.back()} />
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.helper}>Loading active conversations…</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>We couldn&apos;t load your conversations.</Text>
          <Text style={styles.helper}>Please try again.</Text>
          <Pressable accessibilityRole="button" style={styles.retryButton} onPress={() => void load()}>
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.intro}>
            <Text style={styles.title}>Choose a volunteer</Text>
            <Text style={styles.helper}>
              Select an active activity to open your conversation with its volunteer.
            </Text>
          </View>
          {conversations.length ? (
            conversations.map((conversation) => {
              const { request } = conversation;
              const volunteerName = request.volunteerName || "Assigned volunteer";
              return (
                <Pressable
                  key={request.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Message ${volunteerName} about ${request.activityType}`}
                  style={styles.card}
                  onPress={() => openConversation(conversation)}
                >
                  {request.volunteerPhotoUrl ? (
                    <Image source={{ uri: request.volunteerPhotoUrl }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarInitial}>
                        {volunteerName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.cardCopy}>
                    <Text style={styles.volunteerName}>{volunteerName}</Text>
                    <Text style={styles.activity}>{request.activityType}</Text>
                    <Text style={styles.details}>
                      {conversation.elderlyName} · {REQUEST_STATUS_LABELS[request.status]}
                    </Text>
                    <Text style={styles.details}>
                      {request.preferredDate.toLocaleDateString()} · {request.preferredTime}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              );
            })
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No active conversations</Text>
              <Text style={styles.helper}>
                Conversations appear here after a volunteer accepts an activity for your linked elder.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40, gap: 14 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 10 },
  intro: { gap: 6, marginBottom: 4 },
  title: { color: colors.textPrimary, fontSize: 23, lineHeight: 30, fontWeight: "900" },
  helper: { color: colors.textSecondary, fontSize: 15, lineHeight: 22, textAlign: "center" },
  card: { minHeight: 112, flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.surfaceSoft },
  avatarFallback: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: colors.primary, fontSize: 22, fontWeight: "900" },
  cardCopy: { flex: 1, gap: 3 },
  volunteerName: { color: colors.textPrimary, fontSize: 17, fontWeight: "900" },
  activity: { color: colors.primaryDark, fontSize: 14, fontWeight: "800" },
  details: { color: colors.textSecondary, fontSize: 12, lineHeight: 17 },
  chevron: { color: colors.primary, fontSize: 28, fontWeight: "700" },
  emptyCard: { minHeight: 160, justifyContent: "center", alignItems: "center", gap: 8, padding: 24, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  emptyTitle: { color: colors.textPrimary, fontSize: 18, lineHeight: 24, fontWeight: "900", textAlign: "center" },
  retryButton: { minHeight: 50, justifyContent: "center", paddingHorizontal: 24, marginTop: 6, borderRadius: 14, backgroundColor: colors.primary },
  retryText: { color: colors.textOnPrimary, fontSize: 15, fontWeight: "800" },
});
