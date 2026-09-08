import { Link } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brand } from '../components/Brand';
import { useAuth } from '../context/AuthContext';
import { registerUser, type UserRole } from '../services/authService';
import { colors } from '../theme/colors';

const background = require('../../assets/images/silverlink_auth_background_v2.png');
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLES: { value: UserRole; icon: string; label: string; description: string }[] = [
  {
    value: 'elderly',
    icon: '♡',
    label: 'Elderly',
    description: 'Request companionship and everyday help.',
  },
  {
    value: 'volunteer',
    icon: '★',
    label: 'Volunteer',
    description: 'Give your time and support elderly people.',
  },
  {
    value: 'caregiver',
    icon: '⌂',
    label: 'Caregiver',
    description: 'Stay informed about a loved one\'s activities.',
  },
];

type PasswordFieldProps = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  secure: boolean;
  onToggle: () => void;
  placeholder: string;
  invalid?: boolean;
};

function PasswordField({
  label,
  value,
  onChangeText,
  secure,
  onToggle,
  placeholder,
  invalid,
}: PasswordFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputWrapper,
          focused && styles.inputFocused,
          invalid && styles.inputError,
        ]}
      >
        <Text style={styles.inputIcon}>🔒</Text>
        <TextInput
          accessibilityLabel={label}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.inputPlaceholder}
          secureTextEntry={secure}
          autoComplete="new-password"
          returnKeyType="done"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={secure ? `Show ${label.toLowerCase()}` : `Hide ${label.toLowerCase()}`}
          onPress={onToggle}
          style={styles.eyeButton}
          hitSlop={8}
        >
          <Text style={styles.eyeText}>{secure ? '👁' : '🙈'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PasswordCheck({ met, text }: { met: boolean; text: string }) {
  return (
    <View style={styles.checkRow}>
      <View style={[styles.checkDot, met && styles.checkDotMet]}>
        <Text style={[styles.checkIcon, met && styles.checkIconMet]}>
          {met ? '✓' : '○'}
        </Text>
      </View>
      <Text style={[styles.checkText, met && styles.checkTextMet]}>{text}</Text>
    </View>
  );
}

export default function Register() {
  const { retryProfile } = useAuth();
  const [role, setRole] = useState<UserRole>('elderly');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [confirmSecure, setConfirmSecure] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);

  const passwordMismatch =
    confirmPassword.length > 0 && password !== confirmPassword;
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const canSubmit =
    fullName.trim().length >= 2 &&
    EMAIL_PATTERN.test(email.trim()) &&
    password.length >= 8 &&
    confirmPassword === password &&
    !submitting;

  async function handleRegister() {
    setError('');
    if (!canSubmit) {
      setError('Please check each field. Password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const createdUser = await registerUser({ fullName, email, password, role });
      await retryProfile(createdUser.uid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ImageBackground
      source={background}
      resizeMode="cover"
      blurRadius={3}
      style={styles.bg}
    >
      <View style={styles.overlay} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'android' ? 24 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.card}>

              {/* Brand */}
              <Brand />

              {/* Heading */}
              <View style={styles.heading}>
                <Text style={styles.title}>Create Your SilverLink Account</Text>
                <Text style={styles.subtitle}>
                  Join the community and stay connected through trusted support.
                </Text>
              </View>

              {/* Role Selection */}
              <View>
                <Text style={styles.label}>I am joining as</Text>
                <View style={styles.roleGrid}>
                  {ROLES.map((item) => {
                    const active = role === item.value;
                    return (
                      <Pressable
                        key={item.value}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: active }}
                        onPress={() => setRole(item.value)}
                        style={[styles.roleCard, active && styles.roleCardActive]}
                      >
                        {/* Checkmark badge */}
                        <View style={[styles.roleCheck, active && styles.roleCheckActive]}>
                          {active ? (
                            <Text style={styles.roleCheckMark}>✓</Text>
                          ) : null}
                        </View>
                        <Text style={[styles.roleIcon, active && styles.roleIconActive]}>
                          {item.icon}
                        </Text>
                        <Text style={[styles.roleLabel, active && styles.roleLabelActive]}>
                          {item.label}
                        </Text>
                        <Text style={[styles.roleDesc, active && styles.roleDescActive]}>
                          {item.description}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {role === 'volunteer' ? (
                  <View style={styles.infoBadge}>
                    <Text style={styles.infoIcon}>ℹ</Text>
                    <Text style={styles.infoText}>
                      Volunteer accounts require verification before accepting activities.
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Full Name */}
              <View>
                <Text style={styles.label}>Full Name</Text>
                <View style={[styles.inputWrapper, nameFocused && styles.inputFocused]}>
                  <Text style={styles.inputIcon}>○</Text>
                  <TextInput
                    accessibilityLabel="Full name"
                    style={styles.input}
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Your full name"
                    placeholderTextColor={colors.inputPlaceholder}
                    autoCapitalize="words"
                    autoComplete="name"
                    returnKeyType="next"
                    onFocus={() => setNameFocused(true)}
                    onBlur={() => setNameFocused(false)}
                  />
                </View>
              </View>

              {/* Email */}
              <View>
                <Text style={styles.label}>Email Address</Text>
                <View style={[styles.inputWrapper, emailFocused && styles.inputFocused]}>
                  <Text style={styles.inputIcon}>✉</Text>
                  <TextInput
                    accessibilityLabel="Email address"
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    placeholderTextColor={colors.inputPlaceholder}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    returnKeyType="next"
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                  />
                </View>
              </View>

              {/* Password */}
              <PasswordField
                label="Password"
                value={password}
                onChangeText={setPassword}
                secure={secure}
                onToggle={() => setSecure(!secure)}
                placeholder="At least 8 characters"
              />

              {/* Password requirements */}
              {password.length > 0 ? (
                <View style={styles.passwordChecks}>
                  <PasswordCheck met={hasMinLength} text="At least 8 characters" />
                  <PasswordCheck met={hasUppercase} text="One uppercase letter" />
                  <PasswordCheck met={hasNumber} text="One number" />
                </View>
              ) : null}

              {/* Confirm Password */}
              <PasswordField
                label="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secure={confirmSecure}
                onToggle={() => setConfirmSecure(!confirmSecure)}
                placeholder="Repeat your password"
                invalid={passwordMismatch}
              />
              {passwordMismatch ? (
                <Text style={styles.mismatchText}>Passwords do not match.</Text>
              ) : null}

              {/* Error */}
              {error ? (
                <View accessibilityRole="alert" style={styles.errorBox}>
                  <Text style={styles.errorIcon}>⚠</Text>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Terms */}
              <Text style={styles.terms}>
                By creating an account you agree to the Terms of Service and Privacy Policy.
              </Text>

              {/* Submit */}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSubmit, busy: submitting }}
                disabled={!canSubmit}
                style={[styles.primaryButton, !canSubmit && styles.buttonDisabled]}
                onPress={handleRegister}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.textOnPrimary} size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Create Account</Text>
                )}
              </Pressable>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Switch */}
              <Text style={styles.switchText}>
                Already have an account?{' '}
                <Link href="/login" replace style={styles.switchLink}>
                  Log In
                </Link>
              </Text>

            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#E8EAFF' },
  overlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(30,27,75,0.22)',
  },
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingVertical: 28,
    justifyContent: 'center',
  },

  /* Card */
  card: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 28,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#1E1B4B',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 36,
    elevation: 12,
    gap: 22,
  },

  /* Heading */
  heading: { gap: 6 },
  title: {
    color: colors.textPrimary,
    fontSize: 26,
    lineHeight: 33,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },

  /* Label */
  label: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },

  /* Role grid */
  roleGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  roleCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    position: 'relative',
    minHeight: 120,
    justifyContent: 'center',
    gap: 4,
  },
  roleCardActive: {
    borderWidth: 2.5,
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  roleCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleCheckActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  roleCheckMark: {
    color: colors.textOnPrimary,
    fontSize: 11,
    fontWeight: '900',
  },
  roleIcon: {
    fontSize: 24,
    color: colors.textMuted,
    marginBottom: 2,
  },
  roleIconActive: { color: colors.primary },
  roleLabel: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  roleLabelActive: { color: colors.primaryDark },
  roleDesc: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
  },
  roleDescActive: { color: colors.textSecondary },

  /* Info badge */
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.infoLight,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  infoIcon: { color: colors.info, fontSize: 14, fontWeight: '800', marginTop: 1 },
  infoText: {
    flex: 1,
    color: '#075985',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },

  /* Inputs */
  inputWrapper: {
    minHeight: 56,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    gap: 10,
  },
  inputFocused: {
    borderColor: colors.primary,
    borderWidth: 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 2,
  },
  inputError: {
    borderColor: colors.error,
    borderWidth: 2,
  },
  inputIcon: {
    fontSize: 15,
    color: colors.textMuted,
    width: 20,
    textAlign: 'center',
  },
  input: {
    flex: 1,
    minHeight: 54,
    fontSize: 17,
    color: colors.textPrimary,
    backgroundColor: 'transparent',
  },
  eyeButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeText: { fontSize: 18 },

  /* Password checks */
  passwordChecks: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    gap: 8,
    marginTop: -6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkDotMet: {
    backgroundColor: colors.successLight,
    borderColor: colors.success,
  },
  checkIcon: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '800',
  },
  checkIconMet: { color: colors.success },
  checkText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  checkTextMet: { color: colors.textPrimary },

  /* Mismatch */
  mismatchText: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '600',
    marginTop: -10,
  },

  /* Error */
  errorBox: {
    backgroundColor: colors.errorLight,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  errorIcon: { fontSize: 14, color: colors.error, marginTop: 1 },
  errorText: {
    flex: 1,
    color: colors.error,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },

  /* Terms */
  terms: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },

  /* Button */
  primaryButton: {
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3730A3',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  primaryButtonText: {
    color: colors.textOnPrimary,
    fontWeight: '800',
    fontSize: 17,
    letterSpacing: 0.2,
  },
  buttonDisabled: { opacity: 0.5, shadowOpacity: 0 },

  /* Divider */
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  /* Switch */
  switchText: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  switchLink: { color: colors.primary, fontWeight: '800' },
});
