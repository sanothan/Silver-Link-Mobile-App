import { Link } from 'expo-router';
import { type ComponentProps, useMemo, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const logo = require('../../assets/logo/logo_silverlink.png');
const roles = ['Older adult', 'Family member', 'Caregiver'] as const;

export default function Register() {
  const [role, setRole] = useState<(typeof roles)[number]>('Family member');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [confirmSecure, setConfirmSecure] = useState(true);
  const passwordHint = useMemo(() => confirmPassword && password !== confirmPassword ? 'Passwords do not match' : '', [confirmPassword, password]);

  return <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}><View style={styles.brand}><Image source={logo} style={styles.logo} /><Text style={styles.brandName}>SilverLink</Text></View><View style={styles.badge}><Text style={styles.badgeText}>JOIN US</Text></View></View>
        <Text style={styles.title}>Create your account</Text><Text style={styles.subtitle}>A few details and your circle of care is ready to begin.</Text>

        <View style={styles.form}>
          <View><Text style={styles.label}>I am joining as</Text><View style={styles.roleRow}>{roles.map((item) => <Pressable key={item} accessibilityRole="radio" accessibilityState={{ checked: role === item }} onPress={() => setRole(item)} style={[styles.roleChip, role === item && styles.roleChipActive]}><Text style={[styles.roleText, role === item && styles.roleTextActive]}>{item}</Text></Pressable>)}</View></View>
          <Field label="Full name" placeholder="Your full name" autoComplete="name" />
          <Field label="Email address" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          <Field label="Phone number" placeholder="e.g. +94 77 123 4567" keyboardType="phone-pad" autoComplete="tel" />
          <View><Text style={styles.label}>Password</Text><View style={styles.passwordRow}><TextInput style={styles.passwordInput} value={password} onChangeText={setPassword} placeholder="At least 8 characters" placeholderTextColor="#9AA3B5" secureTextEntry={secure} autoComplete="new-password" /><Pressable accessibilityRole="button" onPress={() => setSecure(!secure)} hitSlop={10}><Text style={styles.showPassword}>{secure ? 'Show' : 'Hide'}</Text></Pressable></View></View>
          <View><Text style={styles.label}>Confirm password</Text><View style={[styles.passwordRow, passwordHint ? styles.inputError : null]}><TextInput style={styles.passwordInput} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Repeat your password" placeholderTextColor="#9AA3B5" secureTextEntry={confirmSecure} autoComplete="new-password" /><Pressable accessibilityRole="button" onPress={() => setConfirmSecure(!confirmSecure)} hitSlop={10}><Text style={styles.showPassword}>{confirmSecure ? 'Show' : 'Hide'}</Text></Pressable></View>{passwordHint ? <Text style={styles.errorText}>{passwordHint}</Text> : null}</View>
          <Text style={styles.terms}>By creating an account, you agree to our <Text style={styles.termsLink}>Terms of Service</Text> and <Text style={styles.termsLink}>Privacy Policy</Text>.</Text>
          <Pressable accessibilityRole="button" disabled={Boolean(passwordHint)} style={[styles.primaryButton, passwordHint ? styles.buttonDisabled : null]}><Text style={styles.primaryButtonText}>Create account</Text><Text style={styles.arrow}>→</Text></Pressable>
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
