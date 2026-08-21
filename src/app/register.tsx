import { Link, useRouter } from 'expo-router';
import { type ComponentProps, useMemo, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { registerUser, type UserRole } from '../services/authService';

const logo = require('../../assets/logo/logo_silverlink.png');
const roles: UserRole[] = ['Older adult', 'Family member', 'Caregiver'];

export default function Register() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>('Family member');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [confirmSecure, setConfirmSecure] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const passwordHint = useMemo(() => confirmPassword && password !== confirmPassword ? 'Passwords do not match' : '', [confirmPassword, password]);

  const canSubmit = fullName.trim().length > 0 && email.trim().length > 0 && phone.trim().length > 0
    && password.length > 0 && !passwordHint && !submitting;

  async function handleRegister() {
    setError('');
    setSubmitting(true);
    try {
      await registerUser({ fullName, email, phone, password, role });
      router.replace('/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}><View style={styles.brand}><Image source={logo} style={styles.logo} /><Text style={styles.brandName}>SilverLink</Text></View><View style={styles.badge}><Text style={styles.badgeText}>JOIN US</Text></View></View>
        <Text style={styles.title}>Create your account</Text><Text style={styles.subtitle}>A few details and your circle of care is ready to begin.</Text>

        <View style={styles.form}>
          <View><Text style={styles.label}>I am joining as</Text><View style={styles.roleRow}>{roles.map((item) => <Pressable key={item} accessibilityRole="radio" accessibilityState={{ checked: role === item }} onPress={() => setRole(item)} style={[styles.roleChip, role === item && styles.roleChipActive]}><Text style={[styles.roleText, role === item && styles.roleTextActive]}>{item}</Text></Pressable>)}</View></View>
          <Field label="Full name" value={fullName} onChangeText={setFullName} placeholder="Your full name" autoComplete="name" />
          <Field label="Email address" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          <Field label="Phone number" value={phone} onChangeText={setPhone} placeholder="e.g. +94 77 123 4567" keyboardType="phone-pad" autoComplete="tel" />
          <View><Text style={styles.label}>Password</Text><View style={styles.passwordRow}><TextInput style={styles.passwordInput} value={password} onChangeText={setPassword} placeholder="At least 8 characters" placeholderTextColor="#9AA3B5" secureTextEntry={secure} autoComplete="new-password" /><Pressable accessibilityRole="button" onPress={() => setSecure(!secure)} hitSlop={10}><Text style={styles.showPassword}>{secure ? 'Show' : 'Hide'}</Text></Pressable></View></View>
          <View><Text style={styles.label}>Confirm password</Text><View style={[styles.passwordRow, passwordHint ? styles.inputError : null]}><TextInput style={styles.passwordInput} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Repeat your password" placeholderTextColor="#9AA3B5" secureTextEntry={confirmSecure} autoComplete="new-password" /><Pressable accessibilityRole="button" onPress={() => setConfirmSecure(!confirmSecure)} hitSlop={10}><Text style={styles.showPassword}>{confirmSecure ? 'Show' : 'Hide'}</Text></Pressable></View>{passwordHint ? <Text style={styles.errorText}>{passwordHint}</Text> : null}</View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Text style={styles.terms}>By creating an account, you agree to our <Text style={styles.termsLink}>Terms of Service</Text> and <Text style={styles.termsLink}>Privacy Policy</Text>.</Text>
          <Pressable accessibilityRole="button" disabled={!canSubmit} style={[styles.primaryButton, !canSubmit && styles.buttonDisabled]} onPress={handleRegister}>
            {submitting ? <ActivityIndicator color="#FFFFFF" /> : <><Text style={styles.primaryButtonText}>Create account</Text><Text style={styles.arrow}>→</Text></>}
          </Pressable>
        </View>
        <Text style={styles.switchText}>Already have an account? <Link href="/login" replace style={styles.switchLink}>Sign in</Link></Text>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

type FieldProps = ComponentProps<typeof TextInput> & { label: string };
function Field({ label, ...props }: FieldProps) { return <View><Text style={styles.label}>{label}</Text><TextInput style={styles.input} placeholderTextColor="#9AA3B5" {...props} /></View>; }

const styles = StyleSheet.create({
  flex: { flex: 1 }, screen: { flex: 1, backgroundColor: '#FFFFFF' }, container: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 22 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, brand: { flexDirection: 'row', alignItems: 'center', gap: 10 }, logo: { width: 40, height: 40, borderRadius: 11 }, brandName: { color: '#253061', fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }, badge: { backgroundColor: '#F0F1FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 }, badgeText: { color: '#5966D8', fontSize: 10, fontWeight: '800', letterSpacing: 1.1 }, title: { marginTop: 28, color: '#202842', fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.7 }, subtitle: { marginTop: 7, color: '#6D7791', fontSize: 15, lineHeight: 22, maxWidth: 325 }, form: { marginTop: 25, gap: 17 }, label: { color: '#3A4562', fontSize: 14, fontWeight: '700', marginBottom: 8 }, input: { height: 53, borderWidth: 1, borderColor: '#DDE1EC', borderRadius: 14, paddingHorizontal: 16, fontSize: 16, color: '#202842', backgroundColor: '#FCFCFE' }, roleRow: { flexDirection: 'row', gap: 7 }, roleChip: { flex: 1, minHeight: 42, borderWidth: 1, borderColor: '#DDE1EC', borderRadius: 12, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FCFCFE' }, roleChipActive: { borderColor: '#5966D8', backgroundColor: '#F0F1FF' }, roleText: { color: '#6D7791', fontSize: 12, fontWeight: '700', textAlign: 'center' }, roleTextActive: { color: '#4C59C6' }, passwordRow: { height: 53, borderWidth: 1, borderColor: '#DDE1EC', borderRadius: 14, paddingLeft: 16, paddingRight: 15, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FCFCFE' }, passwordInput: { flex: 1, fontSize: 16, color: '#202842' }, showPassword: { color: '#5260D4', fontSize: 14, fontWeight: '700' }, inputError: { borderColor: '#D65A67' }, errorText: { color: '#C34452', fontSize: 12, marginTop: 5 }, terms: { color: '#7A849B', fontSize: 12, lineHeight: 18 }, termsLink: { color: '#5260D4', fontWeight: '700' }, primaryButton: { height: 56, borderRadius: 16, backgroundColor: '#5260D4', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, shadowColor: '#3846AA', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 3 }, buttonDisabled: { opacity: 0.5 }, primaryButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 }, arrow: { color: '#FFFFFF', fontSize: 22 }, switchText: { marginTop: 25, textAlign: 'center', color: '#737D97', fontSize: 14 }, switchLink: { color: '#5260D4', fontWeight: '800' },
});
