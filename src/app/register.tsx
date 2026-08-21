import { Link, type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AuthShell, authStyles } from '../components/AuthShell';
import { Brand } from '../components/Brand';
import { registerUser, type UserRole } from '../services/authService';
import { colors } from '../theme/colors';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const roles: { value: UserRole; label: string }[] = [
  { value: 'elderly', label: 'Older adult' },
  { value: 'volunteer', label: 'Volunteer' },
  { value: 'caregiver', label: 'Caregiver / family' },
];

export default function Register() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>('elderly');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [confirmSecure, setConfirmSecure] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const canSubmit = fullName.trim().length >= 2 && EMAIL_PATTERN.test(email.trim()) && password.length >= 8 && confirmPassword === password && !submitting;

  async function handleRegister() {
    setError('');
    if (!canSubmit) { setError('Check each field and use a password with at least 8 characters.'); return; }
    setSubmitting(true);
    try { await registerUser({ fullName, email, password, role }); router.replace((role === 'elderly' ? '/(elderly)' : role === 'volunteer' ? '/(volunteer)' : '/home') as Href); }
    catch (err) { setError(err instanceof Error ? err.message : 'Please try again.'); }
    finally { setSubmitting(false); }
  }

  return <AuthShell><View style={authStyles.panel}><Brand /><View style={styles.heading}><Text style={authStyles.title}>Create your account</Text><Text style={authStyles.subtitle}>Start with the essentials. You can add more details later.</Text></View><View style={styles.form}><View><Text style={authStyles.label}>I am joining as</Text><View style={styles.roleList}>{roles.map((item) => <Pressable key={item.value} accessibilityRole="radio" accessibilityState={{ checked: role === item.value }} onPress={() => setRole(item.value)} style={[styles.roleButton, role === item.value && styles.roleButtonActive]}><Text style={[styles.roleText, role === item.value && styles.roleTextActive]}>{item.label}</Text></Pressable>)}</View>{role === 'volunteer' ? <Text style={styles.roleHint}>Volunteer accounts require verification before accepting activities.</Text> : null}</View><View><Text style={authStyles.label}>Full name</Text><TextInput accessibilityLabel="Full name" style={authStyles.input} value={fullName} onChangeText={setFullName} placeholder="Your full name" placeholderTextColor={colors.inputPlaceholder} autoCapitalize="words" autoComplete="name" /></View><View><Text style={authStyles.label}>Email address</Text><TextInput accessibilityLabel="Email address" style={authStyles.input} value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={colors.inputPlaceholder} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" /></View><PasswordField label="Password" value={password} onChangeText={setPassword} secure={secure} onToggle={() => setSecure(!secure)} placeholder="At least 8 characters" /><PasswordField label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} secure={confirmSecure} onToggle={() => setConfirmSecure(!confirmSecure)} placeholder="Repeat your password" invalid={passwordMismatch} />{passwordMismatch ? <Text style={authStyles.errorText}>Passwords do not match.</Text> : null}{error ? <View accessibilityRole="alert" style={authStyles.errorBox}><Text style={authStyles.errorText}>{error}</Text></View> : null}<Text style={styles.terms}>By creating an account, you agree to the Terms of Service and Privacy Policy.</Text><Pressable accessibilityRole="button" accessibilityState={{ disabled: !canSubmit, busy: submitting }} disabled={!canSubmit} style={[authStyles.primaryButton, !canSubmit && authStyles.disabled]} onPress={handleRegister}>{submitting ? <ActivityIndicator color={colors.textOnPrimary} /> : <Text style={authStyles.primaryButtonText}>Create Account</Text>}</Pressable></View><Text style={[authStyles.switchText, styles.switchText]}>Already have an account? <Link href="/login" replace style={authStyles.switchLink}>Log In</Link></Text></View></AuthShell>;
}

type PasswordFieldProps = { label: string; value: string; onChangeText: (value: string) => void; secure: boolean; onToggle: () => void; placeholder: string; invalid?: boolean };
function PasswordField({ label, value, onChangeText, secure, onToggle, placeholder, invalid }: PasswordFieldProps) {
  return <View><Text style={authStyles.label}>{label}</Text><View style={[authStyles.passwordRow, invalid && styles.invalid]}><TextInput accessibilityLabel={label} style={authStyles.passwordInput} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.inputPlaceholder} secureTextEntry={secure} autoComplete="new-password" /><Pressable accessibilityRole="button" accessibilityLabel={secure ? `Show ${label.toLowerCase()}` : `Hide ${label.toLowerCase()}`} onPress={onToggle} style={authStyles.showButton}><Text style={authStyles.showText}>{secure ? 'Show' : 'Hide'}</Text></Pressable></View></View>;
}

const styles = StyleSheet.create({
  heading: { marginTop: 24 }, form: { marginTop: 24, gap: 17 }, roleList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, roleButton: { minHeight: 50, flexGrow: 1, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 13, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }, roleButtonActive: { borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.primaryLight }, roleText: { color: colors.textSecondary, fontSize: 15, fontWeight: '700', textAlign: 'center' }, roleTextActive: { color: colors.primaryDark }, roleHint: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 8 }, invalid: { borderColor: colors.error }, terms: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 }, switchText: { marginTop: 24 },
});
