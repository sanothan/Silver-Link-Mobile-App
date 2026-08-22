import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RequestForm } from '../../components/RequestForm';
import { useAuth } from '../../context/AuthContext';
import { createRequest } from '../../services/requestService';
import { colors } from '../../theme/colors';

export default function Request() { const { user } = useAuth(); const router = useRouter(); const [saving, setSaving] = useState(false); return <SafeAreaView style={styles.safe} edges={['top']}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}><Text style={styles.title}>Request Help</Text><Text style={styles.subtitle}>Tell us what would make your day easier.</Text><RequestForm submitLabel="Request Help" saving={saving} onSubmit={async (values) => { if (!user) return; setSaving(true); try { const id = await createRequest(user.uid, values); Alert.alert('Request created', "We'll let you know when a suitable volunteer is found.", [{ text: 'View Request', onPress: () => router.replace(`/(elderly)/request-details/${id}` as Href) }]); } catch { Alert.alert("We couldn't save your request", 'Please try again.'); } finally { setSaving(false); } }} /></ScrollView></SafeAreaView>; }
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, content: { padding: 20, paddingBottom: 40 }, title: { color: colors.textPrimary, fontSize: 28, fontWeight: '800' }, subtitle: { color: colors.textSecondary, fontSize: 17, lineHeight: 24, marginTop: 6, marginBottom: 24 } });
