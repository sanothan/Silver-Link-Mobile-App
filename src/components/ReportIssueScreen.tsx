import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { submitReport } from '../services/reportService';
import { colors } from '../theme/colors';
import type { ReportCategory } from '../types/report';

export function ReportIssueScreen({ title, message, homeHref }: { title: string; message: string; homeHref: Href }) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [category, setCategory] = useState<ReportCategory>('complaint');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || !profile) return;
    if (!details.trim()) {
      Alert.alert('Add details', 'Please describe the concern before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      await submitReport({ uid: user.uid, role: profile.role, category, urgent: category === 'safety', message: details });
      setDetails('');
      Alert.alert('Report submitted', 'An administrator has been notified and will follow up.');
    } catch {
      Alert.alert('Submission failed', 'Could not submit your report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.icon}><Text style={styles.iconText}>SL</Text></View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>

        <View style={styles.categoryRow}>
          <Pressable
            accessibilityRole="button"
            style={[styles.categoryOption, category === 'complaint' && styles.categoryOptionActive]}
            onPress={() => setCategory('complaint')}
          >
            <Text style={[styles.categoryText, category === 'complaint' && styles.categoryTextActive]}>General Complaint</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={[styles.categoryOption, category === 'safety' && styles.categoryOptionActiveUrgent]}
            onPress={() => setCategory('safety')}
          >
            <Text style={[styles.categoryText, category === 'safety' && styles.categoryTextActive]}>Urgent Safety Concern</Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Describe what happened…"
          placeholderTextColor={colors.inputPlaceholder}
          value={details}
          onChangeText={setDetails}
          multiline
          numberOfLines={5}
        />

        <Pressable accessibilityRole="button" style={[styles.button, submitting && styles.buttonDisabled]} onPress={() => void handleSubmit()} disabled={submitting}>
          <Text style={styles.buttonText}>{submitting ? 'Submitting…' : 'Submit Report'}</Text>
        </Pressable>

        <Pressable accessibilityRole="button" onPress={() => router.replace(homeHref)}>
          <Text style={styles.backLink}>Back to Home</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { alignItems: 'center', padding: 28, paddingBottom: 48 },
  icon: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  iconText: { color: colors.primary, fontSize: 20, fontWeight: '800' },
  title: { color: colors.textPrimary, fontSize: 26, lineHeight: 33, fontWeight: '800', textAlign: 'center' },
  message: { color: colors.textSecondary, fontSize: 17, lineHeight: 26, textAlign: 'center', marginTop: 10, maxWidth: 350 },
  categoryRow: { flexDirection: 'row', gap: 10, marginTop: 26, width: '100%' },
  categoryOption: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  categoryOptionActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  categoryOptionActiveUrgent: { borderColor: colors.error, backgroundColor: colors.errorLight },
  categoryText: { color: colors.textSecondary, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  categoryTextActive: { color: colors.textPrimary },
  input: {
    width: '100%',
    minHeight: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.inputBackground,
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
    padding: 14,
    marginTop: 16,
    textAlignVertical: 'top',
  },
  button: { minHeight: 54, width: '100%', borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.textOnPrimary, fontSize: 17, fontWeight: '800' },
  backLink: { color: colors.primary, fontSize: 15, fontWeight: '700', marginTop: 18 },
});
