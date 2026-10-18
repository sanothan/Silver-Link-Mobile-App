import { type Href, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

export function ComingSoonScreen({ title, message }: { title: string; message: string }) {
  const router = useRouter();
  return <SafeAreaView style={styles.safe}><View style={styles.content}><View style={styles.icon}><Text style={styles.iconText}>SL</Text></View><Text style={styles.title}>{title}</Text><Text style={styles.message}>{message}</Text><Pressable accessibilityRole="button" style={styles.button} onPress={() => router.replace('/(elderly)' as Href)}><Text style={styles.buttonText}>Back to Home</Text></Pressable></View></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }, icon: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }, iconText: { color: colors.primary, fontSize: 20, fontWeight: '800' }, title: { color: colors.textPrimary, fontSize: 26, lineHeight: 33, fontWeight: '800', textAlign: 'center' }, message: { color: colors.textSecondary, fontSize: 17, lineHeight: 26, textAlign: 'center', marginTop: 10, maxWidth: 350 }, button: { minHeight: 54, minWidth: 180, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 28, paddingHorizontal: 20 }, buttonText: { color: colors.textOnPrimary, fontSize: 17, fontWeight: '800' } });
