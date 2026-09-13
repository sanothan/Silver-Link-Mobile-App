import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { hasAcceptedCaregiverLink } from '../../services/caregiverLinkService';
import { updateTrustedContact, getUserProfile } from '../../services/userService';
import { colors } from '../../theme/colors';
import type { TrustedContact, UserProfile } from '../../types/user';

export default function CaregiverTrustedContactScreen() {
  const { elderlyUserId } = useLocalSearchParams<{ elderlyUserId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [contact, setContact] = useState<TrustedContact>({ name: '', relationship: '', phone: '', email: '' });
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !elderlyUserId) {
      setError('Missing required information.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (!(await hasAcceptedCaregiverLink(user.uid, elderlyUserId))) {
        setError('You need an accepted caregiver connection to manage this contact.');
        return;
      }
      const elderlyProfile = await getUserProfile(elderlyUserId);
      setProfile(elderlyProfile);
      setContact(elderlyProfile.trustedContact ?? { name: '', relationship: '', phone: '', email: '' });
      setEditing(!elderlyProfile.trustedContact);
    } catch {
      setError("We couldn't load the trusted contact.");
    } finally {
      setLoading(false);
    }
  }, [elderlyUserId, user]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const save = async () => {
    if (!user || !elderlyUserId) return;
    const clean = {
      name: contact.name.trim(),
      relationship: contact.relationship.trim(),
      phone: contact.phone.trim(),
      ...(contact.email?.trim() ? { email: contact.email.trim() } : {}),
    };
    if (!clean.name || !clean.relationship || !clean.phone) {
      Alert.alert('Complete the required fields', 'Name, relationship, and phone number are required.');
      return;
    }
    setSaving(true);
    try {
      await updateTrustedContact(user.uid, elderlyUserId, clean);
      setContact(clean);
      setProfile((current) => current ? { ...current, trustedContact: clean } : current);
      setEditing(false);
    } catch {
      Alert.alert("We couldn't save the trusted contact", 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    Alert.alert('Remove trusted contact?', 'This contact will no longer be available for this elderly user.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        if (!user || !elderlyUserId) return;
        setSaving(true);
        try {
          await updateTrustedContact(user.uid, elderlyUserId, null);
          setProfile((current) => current ? { ...current, trustedContact: undefined } : current);
          setContact({ name: '', relationship: '', phone: '', email: '' });
          setEditing(true);
        } catch {
          Alert.alert("We couldn't remove the trusted contact", 'Please try again.');
        } finally {
          setSaving(false);
        }
      } },
    ]);
  };

  if (loading) return <Center><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.helper}>Loading trusted contact…</Text></Center>;
  if (error) return <Center><Text style={styles.title}>Trusted contact unavailable</Text><Text style={styles.helper}>{error}</Text><Pressable style={styles.primaryButton} onPress={() => void load()}><Text style={styles.primaryText}>Try Again</Text></Pressable></Center>;

  const saved = profile?.trustedContact;
  return <SafeAreaView style={styles.safe} edges={['top']}>
    <View style={styles.header}><Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.back}>← Back</Text></Pressable><Text style={styles.headerTitle}>Trusted Contact</Text><View style={styles.headerSpacer} /></View>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Trusted contact for {profile?.fullName || 'your loved one'}</Text>
      {editing ? <>
        <Text style={styles.subtitle}>Add a trusted contact for safety and support.</Text>
        <Field label="Full Name" value={contact.name} onChangeText={(value) => setContact((current) => ({ ...current, name: value }))} />
        <Field label="Relationship" value={contact.relationship} onChangeText={(value) => setContact((current) => ({ ...current, relationship: value }))} />
        <Field label="Phone Number" value={contact.phone} keyboardType="phone-pad" onChangeText={(value) => setContact((current) => ({ ...current, phone: value }))} />
        <Field label="Email (optional)" value={contact.email ?? ''} keyboardType="email-address" autoCapitalize="none" onChangeText={(value) => setContact((current) => ({ ...current, email: value }))} />
        <Pressable accessibilityRole="button" disabled={saving} style={[styles.primaryButton, saving && styles.disabled]} onPress={() => void save()}><Text style={styles.primaryText}>{saving ? 'Saving…' : saved ? 'Save Changes' : 'Add Trusted Contact'}</Text></Pressable>
        {saved ? <Pressable accessibilityRole="button" disabled={saving} style={styles.secondaryButton} onPress={() => { setContact(saved); setEditing(false); }}><Text style={styles.secondaryText}>Cancel</Text></Pressable> : null}
      </> : <>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>TRUSTED CONTACT</Text>
          <Info label="Name" value={saved?.name ?? ''} />
          <Info label="Relationship" value={saved?.relationship ?? ''} />
          <Info label="Phone" value={saved?.phone ?? ''} />
          {saved?.email ? <Info label="Email" value={saved.email} /> : null}
        </View>
        <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={() => setEditing(true)}><Text style={styles.primaryText}>Edit</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={saving} style={styles.removeButton} onPress={remove}><Text style={styles.removeText}>Remove Trusted Contact</Text></Pressable>
      </>}
    </ScrollView>
  </SafeAreaView>;
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput {...props} accessibilityLabel={label} style={styles.input} placeholderTextColor={colors.textMuted} /></View>;
}
function Info({ label, value }: { label: string; value: string }) { return <View style={styles.info}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value || 'Not provided'}</Text></View>; }
function Center({ children }: { children: React.ReactNode }) { return <SafeAreaView style={styles.safe}><View style={styles.center}>{children}</View></SafeAreaView>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 58, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  headerTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '800' },
  headerSpacer: { width: 44 },
  content: { padding: 20, gap: 14, paddingBottom: 42 },
  title: { color: colors.textPrimary, fontSize: 24, lineHeight: 31, fontWeight: '800' },
  subtitle: { color: colors.textSecondary, fontSize: 16, lineHeight: 23 },
  helper: { color: colors.textSecondary, fontSize: 16, lineHeight: 23, textAlign: 'center', marginTop: 10 },
  field: { gap: 7 },
  fieldLabel: { color: colors.textPrimary, fontSize: 15, fontWeight: '800' },
  input: { minHeight: 54, borderWidth: 1, borderColor: colors.border, borderRadius: 13, backgroundColor: colors.surface, paddingHorizontal: 15, color: colors.textPrimary, fontSize: 16 },
  card: { backgroundColor: colors.surface, borderRadius: 17, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 14 },
  cardLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '900', letterSpacing: 0.6 },
  info: { gap: 3 },
  infoLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
  infoValue: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  primaryButton: { minHeight: 54, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primaryText: { color: colors.textOnPrimary, fontSize: 17, fontWeight: '800' },
  secondaryButton: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  removeButton: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: colors.error, alignItems: 'center', justifyContent: 'center' },
  removeText: { color: colors.error, fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.55 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
});
