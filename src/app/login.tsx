import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loginUser } from '../services/authService';

const logo = require('../../assets/logo/logo_silverlink.png');

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  async function handleSignIn() {
    setError('');
    setSubmitting(true);
    try {
      await loginUser(email, password);
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
        <View><View style={styles.brand}><Image source={logo} style={styles.logo} /><Text style={styles.brandName}>SilverLink</Text></View><Text style={styles.title}>Welcome back</Text><Text style={styles.subtitle}>Sign in to continue caring and connecting.</Text></View>
        <View style={styles.form}>
          <View><Text style={styles.label}>Email address</Text><TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor="#9AA3B5" keyboardType="email-address" autoCapitalize="none" autoComplete="email" /></View>
          <View><Text style={styles.label}>Password</Text><View style={styles.passwordRow}><TextInput style={styles.passwordInput} value={password} onChangeText={setPassword} placeholder="Enter your password" placeholderTextColor="#9AA3B5" secureTextEntry={secure} autoComplete="current-password" /><Pressable accessibilityRole="button" onPress={() => setSecure(!secure)} hitSlop={10}><Text style={styles.showPassword}>{secure ? 'Show' : 'Hide'}</Text></Pressable></View></View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Pressable accessibilityRole="button"><Text style={styles.forgotPassword}>Forgot password?</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={!canSubmit} style={[styles.primaryButton, !canSubmit && styles.buttonDisabled]} onPress={handleSignIn}>
            {submitting ? <ActivityIndicator color="#FFFFFF" /> : <><Text style={styles.primaryButtonText}>Sign in</Text><Text style={styles.arrow}>→</Text></>}
          </Pressable>
        </View>
        <Text style={styles.switchText}>New to SilverLink? <Link href="/register" style={styles.switchLink}>Create an account</Link></Text>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, screen: { flex: 1, backgroundColor: '#FFFFFF' }, container: { flexGrow: 1, paddingHorizontal: 26, paddingTop: 24, paddingBottom: 22, justifyContent: 'space-between', gap: 38 }, brand: { flexDirection: 'row', alignItems: 'center', gap: 12 }, logo: { width: 42, height: 42, borderRadius: 12 }, brandName: { color: '#253061', fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }, title: { marginTop: 49, color: '#202842', fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -0.8 }, subtitle: { marginTop: 10, color: '#6D7791', fontSize: 16, lineHeight: 24, maxWidth: 300 }, form: { gap: 15 }, label: { color: '#3A4562', fontSize: 14, fontWeight: '700', marginBottom: 8 }, input: { height: 55, borderWidth: 1, borderColor: '#DDE1EC', borderRadius: 14, paddingHorizontal: 16, fontSize: 16, color: '#202842', backgroundColor: '#FCFCFE' }, passwordRow: { height: 55, borderWidth: 1, borderColor: '#DDE1EC', borderRadius: 14, paddingLeft: 16, paddingRight: 15, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FCFCFE' }, passwordInput: { flex: 1, fontSize: 16, color: '#202842' }, showPassword: { color: '#5260D4', fontSize: 14, fontWeight: '700' }, forgotPassword: { color: '#5260D4', fontSize: 14, fontWeight: '700', textAlign: 'right', marginTop: -3 }, errorText: { color: '#C34452', fontSize: 13, fontWeight: '600' }, primaryButton: { height: 56, borderRadius: 16, backgroundColor: '#5260D4', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, marginTop: 5, shadowColor: '#3846AA', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 3 }, buttonDisabled: { opacity: 0.5 }, primaryButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 }, arrow: { color: '#FFFFFF', fontSize: 22 }, switchText: { textAlign: 'center', color: '#737D97', fontSize: 14 }, switchLink: { color: '#5260D4', fontWeight: '800' },
});
