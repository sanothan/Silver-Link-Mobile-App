import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import {
  acceptCaregiverLink,
  getCaregiverLinksForElderly,
  rejectCaregiverLink,
} from "../../services/caregiverLinkService";
import { colors } from "../../theme/colors";
import type { ElderlyCaregiverLinkDisplay } from "../../types/caregiver";

export default function CaregiverConnections() {
  const { user, retryProfile } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<ElderlyCaregiverLinkDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [updatingId, setUpdatingId] = useState<string>();

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(false);
    try {
      setItems(await getCaregiverLinksForElderly(user.uid));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const decide = async (
    item: ElderlyCaregiverLinkDisplay,
    decision: "accepted" | "rejected",
  ) => {
    if (!user || updatingId) return;
    setUpdatingId(item.id);
    try {
      if (decision === "accepted") {
        await acceptCaregiverLink(item.id, user.uid);
        await retryProfile();
      } else {
        await rejectCaregiverLink(item.id, user.uid);
      }
      await load();
    } catch (cause) {
      const alreadyUpdated =
        cause instanceof Error && cause.message.includes("already been updated");
      Alert.alert(
        alreadyUpdated ? "Request already updated" : "We couldn't update this connection request.",
        alreadyUpdated
          ? "This connection request has already been updated. The list will now refresh."
          : "Please try again.",
      );
      await load();
    } finally {
      setUpdatingId(undefined);
    }
  };

  const confirmDecision = (
    item: ElderlyCaregiverLinkDisplay,
    decision: "accepted" | "rejected",
  ) => {
    const accepting = decision === "accepted";
    Alert.alert(
      accepting ? "Accept caregiver connection?" : "Reject this caregiver request?",
      accepting
        ? "This caregiver will be able to view the SilverLink information allowed for linked caregivers."
        : "This caregiver will not be connected to your account.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: accepting ? "Accept" : "Reject",
          style: accepting ? "default" : "destructive",
          onPress: () => void decide(item, decision),
        },
      ],
    );
  };

  const pending = items.filter((item) => item.status === "pending");
  const connected = items.filter((item) => item.status === "accepted");

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <RequestHeader title="Caregiver Connections" onBack={() => router.back()} />
      {loading ? (
        <Centered>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.helper}>Loading caregiver requests…</Text>
        </Centered>
      ) : error ? (
        <Centered>
          <Text style={styles.emptyTitle}>We couldn&apos;t load caregiver requests.</Text>
          <Text style={styles.helper}>Please try again.</Text>
          <Pressable accessibilityRole="button" style={styles.retry} onPress={() => void load()}>
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </Centered>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {connected.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Connected Caregiver</Text>
              {connected.map((item) => (
                <CaregiverCard key={item.id} item={item} connected />
              ))}
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Caregiver Requests</Text>
            {pending.length ? (
              pending.map((item) => (
                <CaregiverCard
                  key={item.id}
                  item={item}
                  busy={updatingId === item.id}
                  onAccept={() => confirmDecision(item, "accepted")}
                  onReject={() => confirmDecision(item, "rejected")}
                />
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No caregiver requests</Text>
                <Text style={styles.helper}>New caregiver connection requests will appear here.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function CaregiverCard({
  item,
  connected,
  busy,
  onAccept,
  onReject,
}: {
  item: ElderlyCaregiverLinkDisplay;
  connected?: boolean;
  busy?: boolean;
  onAccept?: () => void;
  onReject?: () => void;
}) {
  return (
    <View style={styles.card} accessible accessibilityLabel={`${item.caregiverName}, Caregiver`}>
      <View style={styles.personRow}>
        {item.caregiverPhotoUrl ? (
          <Image source={{ uri: item.caregiverPhotoUrl }} style={styles.photo} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.caregiverName.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.personCopy}>
          <Text style={styles.name}>{item.caregiverName}</Text>
          <Text style={styles.role}>{connected ? "Connected Caregiver" : "Caregiver"}</Text>
          {item.relationship ? <Text style={styles.relationship}>{item.relationship}</Text> : null}
          {!connected ? (
            <Text style={styles.date}>Requested {item.createdAt.toLocaleDateString()}</Text>
          ) : null}
        </View>
      </View>
      {!connected ? (
        <>
          <Text style={styles.message}>Would like to connect with your SilverLink account.</Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Reject caregiver request from ${item.caregiverName}`}
              disabled={busy}
              style={[styles.rejectButton, busy && styles.disabled]}
              onPress={onReject}
            >
              <Text style={styles.rejectText}>Reject</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Accept caregiver request from ${item.caregiverName}`}
              disabled={busy}
              style={[styles.acceptButton, busy && styles.disabled]}
              onPress={onAccept}
            >
              {busy ? <ActivityIndicator color={colors.textOnPrimary} /> : <Text style={styles.acceptText}>Accept</Text>}
            </Pressable>
          </View>
        </>
      ) : null}
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40, gap: 24 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 10 },
  section: { gap: 12 },
  sectionTitle: { color: colors.textPrimary, fontSize: 21, lineHeight: 28, fontWeight: "900" },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 18 },
  personRow: { flexDirection: "row", alignItems: "center" },
  photo: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surfaceSoft },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.primary, fontSize: 26, fontWeight: "900" },
  personCopy: { flex: 1, marginLeft: 14 },
  name: { color: colors.textPrimary, fontSize: 20, lineHeight: 26, fontWeight: "900" },
  role: { color: colors.primaryDark, fontSize: 16, fontWeight: "800", marginTop: 3 },
  relationship: { color: colors.textSecondary, fontSize: 16, marginTop: 4 },
  date: { color: colors.textMuted, fontSize: 14, marginTop: 5 },
  message: { color: colors.textSecondary, fontSize: 16, lineHeight: 24, marginTop: 16 },
  actions: { flexDirection: "row", gap: 12, marginTop: 18 },
  rejectButton: { flex: 1, minHeight: 56, borderWidth: 2, borderColor: colors.error, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  rejectText: { color: colors.error, fontSize: 17, fontWeight: "900" },
  acceptButton: { flex: 1, minHeight: 56, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  acceptText: { color: colors.textOnPrimary, fontSize: 17, fontWeight: "900" },
  disabled: { opacity: 0.55 },
  emptyCard: { minHeight: 150, borderWidth: 1, borderColor: colors.border, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", padding: 22 },
  emptyTitle: { color: colors.textPrimary, fontSize: 19, lineHeight: 25, fontWeight: "900", textAlign: "center" },
  helper: { color: colors.textSecondary, fontSize: 16, lineHeight: 23, textAlign: "center" },
  retry: { minHeight: 54, borderRadius: 14, backgroundColor: colors.primary, paddingHorizontal: 22, alignItems: "center", justifyContent: "center", marginTop: 8 },
  retryText: { color: colors.textOnPrimary, fontSize: 17, fontWeight: "900" },
});
