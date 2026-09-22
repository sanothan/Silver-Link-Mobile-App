import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { logoutUser } from '../services/authService';
import { colors } from '../theme/colors';

export default function AccountStatus() {
  const { profile, profileError, retryProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const suspended = profile?.status === 'suspended';

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try { await action(); } finally { setBusy(false); }
  }

  return <SafeAreaView style={styles.safe}><View style={styles.card}>
    <View style={styles.mark}><Text style={styles.markText}>SL</Text></View>
    <Text style={styles.title}>{suspended ? 'Account access paused' : 'Account setup needs attention'}</Text>
    <Text style={styles.body}>{suspended ? 'This account is currently suspended. Please contact SilverLink support or an administrator.' : profileError ?? 'We could not verify the role and status for this account.'}</Text>
    {!suspended ? <Pressable accessibilityRole="button" disabled={busy} style={styles.primary} onPress={() => run(() => retryProfile())}><Text style={styles.primaryText}>Try Again</Text></Pressable> : null}
    <Pressable accessibilityRole="button" disabled={busy} style={styles.secondary} onPress={() => run(logoutUser)}>{busy ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.secondaryText}>Log Out</Text>}</Pressable>
  </View></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: colors.background }, card: { backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 26, alignItems: 'center' }, mark: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }, markText: { color: colors.primary, fontSize: 23, fontWeight: '900' }, title: { color: colors.textPrimary, fontSize: 25, lineHeight: 32, fontWeight: '800', textAlign: 'center' }, body: { color: colors.textSecondary, fontSize: 17, lineHeight: 25, textAlign: 'center', marginTop: 12, marginBottom: 24 }, primary: { width: '100%', minHeight: 54, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, primaryText: { color: colors.textOnPrimary, fontSize: 17, fontWeight: '800' }, secondary: { width: '100%', minHeight: 54, borderRadius: 14, borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 12 }, secondaryText: { color: colors.primary, fontSize: 17, fontWeight: '800' },
});
