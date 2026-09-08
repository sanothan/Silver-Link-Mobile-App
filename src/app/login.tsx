import { Link } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ImageBackground } from 'react-native';
import { Brand } from '../components/Brand';
import { loginUser, requestPasswordReset } from '../services/authService';
import { colors } from '../theme/colors';

const background = require('../../assets/images/silverlink_auth_background_v2.png');
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const canSubmit =
    EMAIL_PATTERN.test(email.trim()) && password.length > 0 && !submitting;

  async function handleSignIn() {
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      await loginUser(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We couldn\'t sign you in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset() {
    setError('');
    setNotice('');
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError('Please enter your email address above first.');
      return;
    }
    setResetting(true);
    try {
      await requestPasswordReset(email);
      setNotice('Password reset instructions were sent to your email.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setResetting(false);
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
            {/* Card */}
            <View style={styles.card}>

              {/* Brand */}
              <Brand />

              {/* Heading */}
              <View style={styles.heading}>
                <Text style={styles.title}>Welcome Back</Text>
                <Text style={styles.subtitle}>
                  Sign in to continue to SilverLink.
                </Text>
              </View>

              {/* Form */}
              <View style={styles.form}>

                {/* Email */}
                <View>
                  <Text style={styles.label}>Email Address</Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      emailFocused && styles.inputFocused,
                    ]}
                  >
                    <Text style={styles.inputIcon}>✉</Text>
                    <TextInput
                      accessibilityLabel="Email address"
                      style={styles.input}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="Enter your email"
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
                <View>
                  <Text style={styles.label}>Password</Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      passwordFocused && styles.inputFocused,
                    ]}
                  >
                    <Text style={styles.inputIcon}>🔒</Text>
                    <TextInput
                      accessibilityLabel="Password"
                      style={styles.input}
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Enter your password"
                      placeholderTextColor={colors.inputPlaceholder}
                      secureTextEntry={secure}
                      autoComplete="current-password"
                      returnKeyType="done"
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => setPasswordFocused(false)}
                      onSubmitEditing={() => {
                        if (canSubmit) void handleSignIn();
                      }}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={secure ? 'Show password' : 'Hide password'}
                      onPress={() => setSecure(!secure)}
                      style={styles.eyeButton}
                      hitSlop={8}
                    >
                      <Text style={styles.eyeText}>{secure ? '👁' : '🙈'}</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Forgot Password */}
                <Pressable
                  accessibilityRole="button"
                  disabled={resetting}
                  onPress={handleReset}
                  style={styles.forgotButton}
                >
                  <Text style={styles.forgotText}>
                    {resetting ? 'Sending reset email…' : 'Forgot password?'}
                  </Text>
                </Pressable>

                {/* Error */}
                {error ? (
                  <View accessibilityRole="alert" style={styles.errorBox}>
                    <Text style={styles.errorIcon}>⚠</Text>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                {/* Success notice */}
                {notice ? (
                  <View accessibilityRole="alert" style={styles.noticeBox}>
                    <Text style={styles.noticeIcon}>✓</Text>
                    <Text style={styles.noticeText}>{notice}</Text>
                  </View>
                ) : null}

                {/* Log In Button */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !canSubmit, busy: submitting }}
                  disabled={!canSubmit}
                  style={[styles.primaryButton, !canSubmit && styles.buttonDisabled]}
                  onPress={handleSignIn}
                >
                  {submitting ? (
                    <ActivityIndicator color={colors.textOnPrimary} size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Log In</Text>
                  )}
                </Pressable>

              </View>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Switch to Register */}
              <Text style={styles.switchText}>
                New to SilverLink?{' '}
                <Link href="/register" style={styles.switchLink}>
                  Create Account
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
    gap: 28,
  },

  /* Heading */
  heading: { gap: 6 },
  title: {
    color: colors.textPrimary,
    fontSize: 30,
    lineHeight: 37,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
  },

  /* Form */
  form: { gap: 18 },
  label: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },

  /* Input wrapper */
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
  inputIcon: {
    fontSize: 16,
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

  /* Forgot */
  forgotButton: {
    alignSelf: 'flex-end',
    minHeight: 40,
    justifyContent: 'center',
    marginTop: -8,
  },
  forgotText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },

  /* Error / Notice */
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
  noticeBox: {
    backgroundColor: colors.successLight,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  noticeIcon: { fontSize: 14, color: colors.success, marginTop: 1 },
  noticeText: {
    flex: 1,
    color: colors.success,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
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
  switchLink: {
    color: colors.primary,
    fontWeight: '800',
  },
});
