import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RequestForm } from "../../../components/RequestForm";
import {
  AppBackground,
  RequestHeader,
} from "../../../components/RequestFlowUI";
import { useAuth } from "../../../context/AuthContext";
import {
  getRequestById,
  updateRequest,
} from "../../../services/requestService";
import { colors } from "../../../theme/colors";
import type { CompanionshipRequest } from "../../../types/request";

export default function EditRequest() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [item, setItem] = useState<CompanionshipRequest | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (user && id)
      getRequestById(id, user.uid)
        .then(setItem)
        .catch(() => setFailed(true));
  }, [id, user]);
  if (failed)
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.title}>Request unavailable</Text>
          <Text style={styles.subtitle}>This request cannot be edited.</Text>
        </View>
      </SafeAreaView>
    );
  if (!item)
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loading}>Loading request…</Text>
        </View>
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <AppBackground>
        <RequestHeader title="Edit Request" onBack={() => router.back()} />
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            <View style={styles.intro}>
              <Text style={styles.title}>Update Request Details</Text>
              <Text style={styles.subtitle}>
                Make only the changes your volunteer needs to know.
              </Text>
            </View>
            <RequestForm
              initial={item}
              submitLabel="Save Changes"
              saving={saving}
              onSubmit={async (values) => {
                if (!user || !id) return;
                setSaving(true);
                try {
                  await updateRequest(id, user.uid, values);
                  Alert.alert(
                    "Request updated",
                    "Your request has been updated.",
                    [{ text: "Done", onPress: () => router.back() }],
                  );
                } catch {
                  Alert.alert(
                    "We couldn't update your request",
                    "Please try again.",
                  );
                } finally {
                  setSaving(false);
                }
              }}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </AppBackground>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 25,
  },
  intro: {
    backgroundColor: colors.primaryLight,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    padding: 17,
    marginBottom: 22,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 25,
    lineHeight: 32,
    fontWeight: "900",
    textAlign: "center",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 17,
    lineHeight: 24,
    marginTop: 6,
    textAlign: "center",
  },
  loading: { color: colors.textSecondary, fontSize: 16, marginTop: 12 },
});
