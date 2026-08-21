import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AuthShell, authStyles } from '../components/AuthShell';
import { Brand } from '../components/Brand';
import { loginUser, requestPasswordReset } from '../services/authService';
import { colors } from '../theme/colors';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const canSubmit = EMAIL_PATTERN.test(email.trim()) && password.length > 0 && !submitting;

  async function handleSignIn() {
    setError(''); setNotice(''); setSubmitting(true);
    try { await loginUser(email, password); router.replace('/home'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Please try again.'); }
    finally { setSubmitting(false); }
  }

  async function handleReset() {
    setError(''); setNotice('');
    if (!EMAIL_PATTERN.test(email.trim())) { setError('Enter your email address first.'); return; }
    setResetting(true);
    try { await requestPasswordReset(email); setNotice('Password reset instructions were sent to your email.'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Please try again.'); }
    finally { setResetting(false); }
  }

  return <AuthShell><View style={authStyles.panel}><Brand /><View style={styles.heading}><Text style={authStyles.title}>Welcome back</Text><Text style={authStyles.subtitle}>Log in to continue caring and connecting.</Text></View><View style={styles.form}><View><Text style={authStyles.label}>Email address</Text><TextInput accessibilityLabel="Email address" style={authStyles.input} value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={colors.inputPlaceholder} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" returnKeyType="next" /></View><View><Text style={authStyles.label}>Password</Text><View style={authStyles.passwordRow}><TextInput accessibilityLabel="Password" style={authStyles.passwordInput} value={password} onChangeText={setPassword} placeholder="Enter your password" placeholderTextColor={colors.inputPlaceholder} secureTextEntry={secure} autoComplete="current-password" returnKeyType="done" onSubmitEditing={() => { if (canSubmit) void handleSignIn(); }} /><Pressable accessibilityRole="button" accessibilityLabel={secure ? 'Show password' : 'Hide password'} onPress={() => setSecure(!secure)} style={authStyles.showButton}><Text style={authStyles.showText}>{secure ? 'Show' : 'Hide'}</Text></Pressable></View></View>{error ? <View accessibilityRole="alert" style={authStyles.errorBox}><Text style={authStyles.errorText}>{error}</Text></View> : null}{notice ? <View accessibilityRole="alert" style={styles.notice}><Text style={styles.noticeText}>{notice}</Text></View> : null}<Pressable accessibilityRole="button" disabled={resetting} onPress={handleReset} style={styles.forgotButton}><Text style={styles.forgotText}>{resetting ? 'Sending…' : 'Forgot password?'}</Text></Pressable><Pressable accessibilityRole="button" accessibilityState={{ disabled: !canSubmit, busy: submitting }} disabled={!canSubmit} style={[authStyles.primaryButton, !canSubmit && authStyles.disabled]} onPress={handleSignIn}>{submitting ? <ActivityIndicator color={colors.textOnPrimary} /> : <Text style={authStyles.primaryButtonText}>Log In</Text>}</Pressable></View><Text style={authStyles.switchText}>New to SilverLink? <Link href="/register" style={authStyles.switchLink}>Sign Up</Link></Text></View></AuthShell>;
}

const styles = StyleSheet.create({
  heading: { marginTop: 28 }, form: { marginTop: 28, gap: 16 }, forgotButton: { minHeight: 48, alignSelf: 'flex-end', justifyContent: 'center', paddingHorizontal: 4, marginTop: -8 }, forgotText: { color: colors.primary, fontSize: 15, fontWeight: '800' }, notice: { backgroundColor: colors.successLight, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 }, noticeText: { color: colors.success, fontSize: 14, lineHeight: 20, fontWeight: '600' },
});
