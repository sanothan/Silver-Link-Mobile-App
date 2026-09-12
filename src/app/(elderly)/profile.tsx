import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { logoutUser } from '../../services/authService';
import { getCaregiverLinksForElderly } from '../../services/caregiverLinkService';
import { updateUserProfile } from '../../services/userService';
import { colors } from '../../theme/colors';
import type { ElderlyCaregiverLinkDisplay } from '../../types/caregiver';

const ROLE_LABELS: Record<string, string> = {
  elderly: 'Elderly Member',
  volunteer: 'Volunteer',
  caregiver: 'Caregiver',
  admin: 'Administrator',
};

export default function Profile() {
  const { profile, user, retryProfile } = useAuth();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState(profile?.fullName ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [locality, setLocality] = useState(profile?.locality ?? '');
  const [language, setLanguage] = useState(profile?.preferredLanguage ?? '');
  const [caregiverLinks, setCaregiverLinks] = useState<ElderlyCaregiverLinkDisplay[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      getCaregiverLinksForElderly(user.uid).then(setCaregiverLinks).catch(() => undefined);
    }, [user]),
  );

  async function save() {
    if (!user || fullName.trim().length < 2)
      return Alert.alert('Check your name', 'Please enter your full name.');
    setSaving(true);
    try {
      await updateUserProfile(user.uid, {
        fullName,
        phone,
        locality,
        preferredLanguage: language,
      });
      await retryProfile();
      setEditing(false);
      Alert.alert('Profile updated', 'Your information has been saved.');
    } catch {
      Alert.alert("We couldn't update your profile", 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const name = profile?.fullName || user?.displayName || 'SilverLink member';
  const roleLabel = profile?.role ? ROLE_LABELS[profile.role] ?? profile.role : '';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Profile</Text>
        </View>

        {/* Avatar section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
            </View>
          </View>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.email}>{profile?.email || user?.email}</Text>
          {roleLabel ? (
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{roleLabel}</Text>
            </View>
          ) : null}
        </View>

        {/* Info / Edit */}
        <View style={styles.section}>
          {editing ? (
            <View style={styles.form}>
              <Text style={styles.sectionTitle}>Edit Profile</Text>
              <Field label="Full name" value={fullName} onChangeText={setFullName} />
              <Field label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              <Field label="Locality" value={locality} onChangeText={setLocality} />
              <Field label="Preferred language" value={language} onChangeText={setLanguage} />

              <Pressable
                accessibilityRole="button"
                disabled={saving}
                style={styles.primaryButton}
                onPress={() => void save()}
              >
                {saving ? (
                  <ActivityIndicator color={colors.textOnPrimary} />
                ) : (
                  <Text style={styles.primaryButtonText}>Save Profile</Text>
                )}
              </Pressable>

              <Pressable
                accessibilityRole="button"
                style={styles.cancelButton}
                onPress={() => setEditing(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Your Information</Text>
              <InfoRow label="Phone" value={profile?.phone} />
              <InfoRow label="Locality" value={profile?.locality} />
              <InfoRow label="Preferred language" value={profile?.preferredLanguage} />
              {profile?.caregiverId ? (
                <InfoRow label="Caregiver linked" value="Connected" positive />
              ) : null}

              <Pressable
                accessibilityRole="button"
                style={styles.primaryButton}
                onPress={() => setEditing(true)}
              >
                <Text style={styles.primaryButtonText}>Edit Profile</Text>
              </Pressable>
            </View>
          )}
        </View>

        {!editing ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Caregiver Connection</Text>
            <View style={styles.accountCard}>
              <View style={styles.connectionContent}>
                <Text style={styles.connectionTitle}>
                  {caregiverLinks.some((item) => item.status === 'accepted')
                    ? caregiverLinks.find((item) => item.status === 'accepted')?.caregiverName
                    : caregiverLinks.some((item) => item.status === 'pending')
                      ? 'Caregiver request waiting'
                      : 'No caregiver connected'}
                </Text>
                <Text style={styles.connectionText}>
                  {caregiverLinks.some((item) => item.status === 'pending')
                    ? 'Review and respond to your pending caregiver request.'
                    : 'Manage your caregiver connection securely.'}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  style={styles.connectionButton}
                  onPress={() =>
                    router.push('/(elderly)/caregiver-connections' as Href)
                  }
                >
                  <Text style={styles.connectionButtonText}>
                    {caregiverLinks.some((item) => item.status === 'pending') ? 'Review Request' : 'View Connection'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        {/* Account section */}
        {!editing ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.accountCard}>
              <View style={styles.accountRow}>
                <Text style={styles.accountLabel}>Email</Text>
                <Text style={styles.accountValue} numberOfLines={1}>
                  {profile?.email || user?.email || '—'}
                </Text>
              </View>
              <View style={styles.separator} />
              <View style={styles.accountRow}>
                <Text style={styles.accountLabel}>Role</Text>
                <Text style={styles.accountValue}>{roleLabel || '—'}</Text>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              style={styles.logoutButton}
              onPress={logoutUser}
            >
              <Text style={styles.logoutText}>Log Out</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
  positive,
}: {
  label: string;
  value?: string;
  positive?: boolean;
}) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text
        style={[
          infoStyles.value,
          !value && infoStyles.valueEmpty,
          positive && infoStyles.valuePositive,
        ]}
      >
        {value || 'Not added'}
      </Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType = 'default',
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'phone-pad' | 'email-address';
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <Text style={infoStyles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        style={[infoStyles.input, focused && infoStyles.inputFocused]}
        placeholderTextColor={colors.inputPlaceholder}
        keyboardType={keyboardType}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  value: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
    flex: 1,
  },
  valueEmpty: { color: colors.textMuted, fontStyle: 'italic', fontWeight: '400' },
  valuePositive: { color: colors.success },
  fieldLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    minHeight: 54,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    color: colors.textPrimary,
    fontSize: 16,
  },
  inputFocused: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingBottom: 50,
  },

  /* Page header */
  pageHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  pageTitle: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
  },

  /* Avatar */
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    gap: 8,
  },
  avatarRing: {
    padding: 4,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: colors.primary + '40',
    marginBottom: 4,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.primary + '20',
  },
  avatarText: { color: colors.primary, fontSize: 38, fontWeight: '800' },
  name: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  email: {
    color: colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
  },
  roleBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    marginTop: 4,
  },
  roleBadgeText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  /* Sections */
  section: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
  },
  infoSection: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 18,
    overflow: 'hidden',
    paddingTop: 16,
  },
  form: {
    gap: 14,
  },

  /* Account card */
  accountCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  connectionContent: { padding: 18 },
  connectionTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '800' },
  connectionText: { color: colors.textSecondary, fontSize: 16, lineHeight: 23, marginTop: 6 },
  connectionButton: { minHeight: 52, borderRadius: 13, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginTop: 15 },
  connectionButtonText: { color: colors.primaryDark, fontSize: 16, fontWeight: '800' },
  accountRow: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  separator: { height: 1, backgroundColor: colors.border },
  accountLabel: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
  accountValue: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },

  /* Buttons */
  primaryButton: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    shadowColor: '#3730A3',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryButtonText: { color: colors.textOnPrimary, fontSize: 17, fontWeight: '800' },
  cancelButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: colors.textSecondary, fontSize: 16, fontWeight: '700' },
  logoutButton: {
    minHeight: 56,
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: { color: colors.error, fontSize: 17, fontWeight: '800' },
});
