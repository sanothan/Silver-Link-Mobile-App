import type { ReactNode } from 'react';
import { ImageBackground, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

const background = require('../../assets/images/silverlink_auth_background_v2.png');

type AuthShellProps = { children: ReactNode; scroll?: boolean };

export function AuthShell({ children, scroll = true }: AuthShellProps) {
  const content = scroll ? (
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
  ) : <View style={styles.centerContent}>{children}</View>;

  return (
    <ImageBackground source={background} resizeMode="cover" blurRadius={2} style={styles.background} imageStyle={styles.image}>
      <View style={styles.overlay} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {content}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

export const authStyles = StyleSheet.create({
  panel: { width: '100%', maxWidth: 520, alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.38)', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.70)', shadowColor: colors.shadow, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.16, shadowRadius: 24, elevation: 5 },
  title: { color: colors.textPrimary, fontSize: 30, lineHeight: 37, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { color: colors.textSecondary, fontSize: 16, lineHeight: 24, marginTop: 8 },
  label: { color: colors.textPrimary, fontSize: 16, lineHeight: 21, fontWeight: '700', marginBottom: 8 },
  input: { minHeight: 56, borderWidth: 1, borderColor: 'rgba(203,213,225,0.82)', borderRadius: 14, paddingHorizontal: 16, fontSize: 17, color: colors.textPrimary, backgroundColor: 'rgba(255,255,255,0.62)' },
  passwordRow: { minHeight: 56, borderWidth: 1, borderColor: 'rgba(203,213,225,0.82)', borderRadius: 14, paddingLeft: 16, paddingRight: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.62)' },
  passwordInput: { flex: 1, minHeight: 54, fontSize: 17, color: colors.textPrimary },
  showButton: { minWidth: 56, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  showText: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  errorBox: { backgroundColor: colors.errorLight, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  errorText: { color: colors.error, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  primaryButton: { minHeight: 56, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, shadowColor: colors.primaryDark, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 3 },
  primaryButtonText: { color: colors.textOnPrimary, fontWeight: '800', fontSize: 17 },
  secondaryButton: { minHeight: 56, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: colors.primary, fontWeight: '800', fontSize: 17 },
  disabled: { opacity: 0.55 },
  switchText: { color: colors.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  switchLink: { color: colors.primary, fontWeight: '800' },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  background: { flex: 1, backgroundColor: colors.primaryLight },
  image: { opacity: 1 },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(238,242,255,0.24)' },
  safeArea: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 18, paddingVertical: 20, justifyContent: 'center' },
  centerContent: { flex: 1, paddingHorizontal: 18, paddingVertical: 20, justifyContent: 'center' },
});
