import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { logoutUser } from '../services/authService';
import { colors } from '../theme/colors';

export default function Home() {
  const { user } = useAuth();

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome{user?.displayName ? `, ${user.displayName}` : ''}!</Text>
        <Text style={styles.subtitle}>{user?.email}</Text>
        <Pressable accessibilityRole="button" style={styles.button} onPress={logoutUser}><Text style={styles.buttonText}>Log Out</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24 },
  title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: 16, color: colors.textSecondary },
  button: { minWidth: 140, minHeight: 52, marginTop: 16, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '800' },
});
