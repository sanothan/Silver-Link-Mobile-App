import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { logoutUser } from '../../services/authService';
import { colors } from '../../theme/colors';

export default function AdminProfileScreen() {
  const { profile, user } = useAuth();
  const name = profile?.fullName || user?.displayName || 'SilverLink Admin';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text></View>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.email}>{profile?.email || user?.email}</Text>
        <View style={styles.roleBadge}><Text style={styles.roleBadgeText}>Administrator</Text></View>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => void logoutUser()}>
          <Text style={styles.buttonText}>Log Out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  avatar: { width: 82, height: 82, borderRadius: 41, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontSize: 34, fontWeight: '800' },
  name: { color: colors.textPrimary, fontSize: 25, fontWeight: '800', marginTop: 16, textAlign: 'center' },
  email: { color: colors.textSecondary, fontSize: 16, marginTop: 6 },
  roleBadge: { backgroundColor: colors.surfaceSoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, marginTop: 16 },
  roleBadgeText: { color: colors.textSecondary, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  button: { minWidth: 170, minHeight: 54, marginTop: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: colors.primary, fontSize: 17, fontWeight: '800' },
});
