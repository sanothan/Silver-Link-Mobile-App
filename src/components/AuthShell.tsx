import type { ReactNode } from 'react';
import { ImageBackground, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

const background = require('../../assets/images/silverlink_auth_background_v2.png');

type AuthShellProps = { children: ReactNode; scroll?: boolean };

export function AuthShell({ children, scroll = true }: AuthShellProps) {
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.centerContent}>{children}</View>
  );

  return (
    <ImageBackground
      source={background}
      resizeMode="cover"
      blurRadius={3}
      style={styles.background}
      imageStyle={styles.image}
    >
      <View style={styles.overlay} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'android' ? 24 : 0}
        >
          {content}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

export const authStyles = StyleSheet.create({
  panel: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 28,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
    shadowColor: '#1E1B4B',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 10,
  },
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
    marginTop: 6,
  },
  label: {
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.1,
  },
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
  inputWrapperFocused: {
    borderColor: colors.primary,
    borderWidth: 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  inputWrapperError: {
    borderColor: colors.error,
    borderWidth: 2,
  },
  inputIcon: {
    color: colors.textMuted,
    fontSize: 17,
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
  // Legacy compat — kept for components not yet migrated
  passwordRow: {
    minHeight: 56,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    paddingLeft: 14,
    paddingRight: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  passwordInput: {
    flex: 1,
    minHeight: 54,
    fontSize: 17,
    color: colors.textPrimary,
  },
  showButton: {
    minWidth: 60,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  showText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  errorBox: {
    backgroundColor: colors.errorLight,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    flex: 1,
  },
  primaryButton: {
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    shadowColor: '#3730A3',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 5,
  },
  primaryButtonText: {
    color: colors.textOnPrimary,
    fontWeight: '800',
    fontSize: 17,
    letterSpacing: 0.2,
  },
  secondaryButton: {
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 17,
    letterSpacing: 0.2,
  },
  disabled: { opacity: 0.5 },
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  background: { flex: 1, backgroundColor: '#E8EAFF' },
  image: { opacity: 1 },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(30, 27, 75, 0.22)',
  },
  safeArea: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingVertical: 24,
    justifyContent: 'center',
  },
  centerContent: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 24,
    justifyContent: 'center',
  },
});
