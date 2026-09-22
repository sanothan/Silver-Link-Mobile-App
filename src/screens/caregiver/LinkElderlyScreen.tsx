import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import {
    findElderlyUserByEmail,
    sendCaregiverLinkRequest,
} from "../../services/caregiverLinkService";
import { colors } from "../../theme/colors";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Screen = "search" | "review" | "success";

interface FoundElderly {
  uid: string;
  fullName: string;
  email: string;
  photoUrl?: string;
}

export default function LinkElderlyScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [currentScreen, setCurrentScreen] = useState<Screen>("search");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [foundElderly, setFoundElderly] = useState<FoundElderly | null>(null);
  const [sentRequest, setSentRequest] = useState<FoundElderly | null>(null);

  const handleFindUser = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      if (!EMAIL_PATTERN.test(email.trim())) {
        throw new Error("Please enter a valid email address.");
      }

      const elderly = await findElderlyUserByEmail(email);

      if (!elderly) {
        throw new Error(
          "We couldn't find an elderly SilverLink user with those details.",
        );
      }

      setFoundElderly(elderly);
      setCurrentScreen("review");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [email]);

  const handleSendRequest = useCallback(async () => {
    if (!foundElderly || !user?.uid) return;

    setError(null);
    setLoading(true);

    try {
      await sendCaregiverLinkRequest(user.uid, foundElderly.uid);
      setSentRequest(foundElderly);
      setCurrentScreen("success");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't send the connection request. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [foundElderly, user?.uid]);

  const handleBackToSearch = useCallback(() => {
    setEmail("");
    setFoundElderly(null);
    setError(null);
    setCurrentScreen("search");
  }, []);

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  if (currentScreen === "search") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.screen}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            <View style={styles.headerSection}>
              <Text style={styles.title}>Link Elderly User</Text>
              <Text style={styles.subtitle}>
                Find your family member and send them a connection request.
              </Text>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.label}>Elderly User Email</Text>
              <TextInput
                accessibilityLabel="Elderly user email address"
                style={styles.input}
                placeholder="Enter their SilverLink email"
                placeholderTextColor={colors.inputPlaceholder}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                returnKeyType="done"
                editable={!loading}
                onSubmitEditing={handleFindUser}
              />

              {error ? (
                <View accessibilityRole="alert" style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityState={{
                  disabled: !EMAIL_PATTERN.test(email.trim()) || loading,
                  busy: loading,
                }}
                disabled={!EMAIL_PATTERN.test(email.trim()) || loading}
                style={[
                  styles.findButton,
                  (!EMAIL_PATTERN.test(email.trim()) || loading) &&
                    styles.disabledButton,
                ]}
                onPress={handleFindUser}
              >
                {loading ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.textOnPrimary}
                  />
                ) : (
                  <Text style={styles.findButtonText}>Find User</Text>
                )}
              </Pressable>
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.infoTitle}>How it works</Text>
              <Text style={styles.infoText}>
                • Enter your family member's SilverLink email address
              </Text>
              <Text style={styles.infoText}>
                • Review their basic profile information
              </Text>
              <Text style={styles.infoText}>• Send a connection request</Text>
              <Text style={styles.infoText}>
                • They will need to confirm to activate the connection
              </Text>
            </View>
          </ScrollView>

          <Pressable
            style={styles.cancelButton}
            onPress={handleClose}
            accessibilityRole="button"
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (currentScreen === "review" && foundElderly) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.screen}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            <View style={styles.headerSection}>
              <Text style={styles.title}>Confirm Connection</Text>
              <Text style={styles.subtitle}>
                Review this person's information before sending a connection
                request.
              </Text>
            </View>

            <View style={styles.profileCard}>
              <View style={styles.avatarContainer}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {foundElderly.fullName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              </View>

              <Text style={styles.profileName}>{foundElderly.fullName}</Text>
              <Text style={styles.profileRole}>SilverLink Elderly User</Text>

              <View style={styles.profileDivider} />

              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{foundElderly.email}</Text>
            </View>

            {error ? (
              <View accessibilityRole="alert" style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.actionBar}>
            <Pressable
              style={[styles.secondaryButton, styles.flex]}
              onPress={handleBackToSearch}
              accessibilityRole="button"
              disabled={loading}
            >
              <Text style={styles.secondaryButtonText}>Back</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: loading, busy: loading }}
              disabled={loading}
              style={[
                styles.primaryButton,
                styles.flex,
                loading && styles.disabledButton,
              ]}
              onPress={handleSendRequest}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <Text style={styles.primaryButtonText}>
                  Send Connection Request
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (currentScreen === "success" && sentRequest) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.screen}>
          <View style={styles.successContainer}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successTitle}>Connection Request Sent</Text>
            <Text style={styles.successMessage}>
              Your connection request has been sent to {sentRequest.fullName}.
            </Text>
            <Text style={styles.successNote}>
              They will receive a notification and can accept or decline your
              request. Once confirmed, you'll be able to monitor their
              activities.
            </Text>

            <Pressable
              accessibilityRole="button"
              style={styles.primaryButton}
              onPress={handleClose}
            >
              <Text style={styles.primaryButtonText}>Back to Dashboard</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return null;
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
  headerSection: {
    marginBottom: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  formSection: {
    marginBottom: 32,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 14,
  },
  errorBox: {
    backgroundColor: colors.errorLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 14,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  findButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
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
  secondaryButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.5,
  },
  findButtonText: {
    color: colors.textOnPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  infoSection: {
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.primary,
    marginBottom: 4,
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    marginBottom: 20,
    alignItems: "center",
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.primary,
  },
  profileName: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.textPrimary,
    marginBottom: 4,
    textAlign: "center",
  },
  profileRole: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
  },
  profileDivider: {
    height: 1,
    backgroundColor: colors.border,
    width: "100%",
    marginVertical: 16,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
    alignSelf: "flex-start",
  },
  infoValue: {
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 8,
    alignSelf: "flex-start",
  },
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  successIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.success,
    marginBottom: 12,
    textAlign: "center",
  },
  successMessage: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: 12,
  },
  successNote: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 24,
  },
  actionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  flex: {
    flex: 1,
  },
  cancelButton: {
    position: "absolute",
    bottom: 12,
    right: 20,
  },
  cancelButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "700",
  },
});
