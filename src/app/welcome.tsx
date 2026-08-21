import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthShell, authStyles } from '../components/AuthShell';
import { Brand } from '../components/Brand';
import { colors } from '../theme/colors';

export default function Welcome() {
  const router = useRouter();
  return <AuthShell scroll={false}><View style={[authStyles.panel, styles.panel]}><Brand large /><View><Text style={styles.tagline}>Connecting generations, strengthening communities.</Text><Text style={styles.support}>Connect with trusted people in your community and make every moment meaningful.</Text></View><View style={styles.actions}><Pressable accessibilityRole="button" style={authStyles.primaryButton} onPress={() => router.push('/login')}><Text style={authStyles.primaryButtonText}>Log In</Text></Pressable><Pressable accessibilityRole="button" style={authStyles.secondaryButton} onPress={() => router.push('/register')}><Text style={authStyles.secondaryButtonText}>Sign Up</Text></Pressable></View><Text style={styles.trust}>Built for simple, respectful community connections.</Text></View></AuthShell>;
}

const styles = StyleSheet.create({
  panel: { gap: 30, paddingVertical: 32 },
  tagline: { color: colors.textPrimary, fontSize: 28, lineHeight: 36, fontWeight: '800', letterSpacing: -0.5 },
  support: { color: colors.textSecondary, fontSize: 17, lineHeight: 26, marginTop: 12 },
  actions: { gap: 12 },
  trust: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
