import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { logoutUser } from '../../services/authService';
import { colors } from '../../theme/colors';
import { getVolunteerPreferences, saveVolunteerInterests, updateUserProfile } from '../../services/userService';
import { REQUEST_ACTIVITY_TYPES, type RequestActivityType } from '../../types/request';

export default function VolunteerProfile() {
  const { profile, user } = useAuth();
  const [interests, setInterests] = useState<RequestActivityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [fullName, setFullName] = useState(profile?.fullName || user?.displayName || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [locality, setLocality] = useState(profile?.locality || '');
  const saveInFlight = useRef(false);
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true); setLoadError(false); setMessage('');
    try { setInterests((await getVolunteerPreferences(user.uid)).preferredActivityTypes); }
    catch { setLoadError(true); }
    finally { setLoading(false); }
  }, [user]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const save = async () => {
    if (!user || saveInFlight.current) return;
    saveInFlight.current = true; setSaving(true); setMessage('');
    try { await saveVolunteerInterests(user.uid, interests); setMessage('Your activity interests have been saved.'); }
    catch { setMessage("We couldn't save your activity interests. Please try again."); }
    finally { saveInFlight.current = false; setSaving(false); }
  };
  const saveProfile = async () => {
    if (!user || !fullName.trim()) { setMessage('Please enter your name.'); return; }
    setSaving(true); setMessage('');
    try { await updateUserProfile(user.uid, { fullName, phone, locality }); setEditingProfile(false); setMessage('Your profile has been updated.'); }
    catch { setMessage("We couldn't update your profile. Please try again."); }
    finally { setSaving(false); }
  };
  const name = profile?.fullName || user?.displayName || 'SilverLink volunteer';
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.avatar}><Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text></View>
    <Text style={styles.name}>{name}</Text><Text style={styles.email}>{profile?.email || user?.email}</Text>
    <Text style={styles.status}>{profile?.status === 'pending' ? 'Verification pending' : 'Verified volunteer'}</Text>
    <View style={interestStyles.section}>
      <Text style={interestStyles.heading}>Profile</Text>
      {editingProfile ? <>
        <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Full name" placeholderTextColor={colors.textSecondary} editable={!saving} />
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Phone (optional)" placeholderTextColor={colors.textSecondary} editable={!saving} keyboardType="phone-pad" />
        <TextInput style={styles.input} value={locality} onChangeText={setLocality} placeholder="Locality (optional)" placeholderTextColor={colors.textSecondary} editable={!saving} />
        <Pressable accessibilityRole="button" disabled={saving} style={styles.button} onPress={() => void saveProfile()}><Text style={styles.buttonText}>{saving ? 'Saving...' : 'Save Profile'}</Text></Pressable>
      </> : <Pressable accessibilityRole="button" style={styles.button} onPress={() => setEditingProfile(true)}><Text style={styles.buttonText}>Edit Profile</Text></Pressable>}
      <Text style={interestStyles.body}>Your email, role, account status, and verification decision are protected.</Text>
    </View>
    <View style={interestStyles.section}>
      <Text style={interestStyles.heading}>Activity Interests</Text>
      <Text style={interestStyles.body}>Choose the activities you are interested in helping with.</Text>
      {loading ? <ActivityIndicator accessibilityLabel="Loading activity interests" color={colors.primary} /> : loadError ? <>
        <Text accessibilityRole="alert" style={interestStyles.body}>We couldn&apos;t load your activity interests. Please try again.</Text>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => void load()}><Text style={styles.buttonText}>Try Again</Text></Pressable>
      </> : <>
        {REQUEST_ACTIVITY_TYPES.map((activity) => {
          const selected = interests.includes(activity);
          return <Pressable key={activity} accessibilityRole="checkbox" accessibilityLabel={activity} accessibilityState={{ checked: selected, disabled: saving }} disabled={saving}
            style={[interestStyles.choice, selected && interestStyles.selected]}
            onPress={() => { setMessage(''); setInterests((current) => selected ? current.filter((value) => value !== activity) : [...current, activity]); }}>
            <Text style={interestStyles.choiceText}>{selected ? '✓' : '○'} {activity}</Text>
          </Pressable>;
        })}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: saving }} disabled={saving} style={styles.button} onPress={() => void save()}>
          {saving ? <ActivityIndicator color={colors.primary} /> : null}<Text style={styles.buttonText}>{saving ? 'Saving...' : 'Save Interests'}</Text>
        </Pressable>
        {message ? <Text accessibilityLiveRegion="polite" style={interestStyles.body}>{message}</Text> : null}
      </>}
    </View>
    <Pressable accessibilityRole="button" style={styles.button} onPress={logoutUser}><Text style={styles.buttonText}>Log Out</Text></Pressable>
  </ScrollView></SafeAreaView>;
}

const interestStyles = StyleSheet.create({
  section: { alignSelf: 'stretch', marginTop: 28, gap: 12 },
  heading: { color: colors.textPrimary, fontSize: 22, fontWeight: '800' },
  body: { color: colors.textSecondary, fontSize: 16, lineHeight: 23 },
  choice: { minHeight: 54, borderRadius: 13, padding: 14, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', backgroundColor: colors.surface },
  selected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  choiceText: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
});

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, content: { flexGrow: 1, alignItems: 'center', padding: 24, paddingBottom: 40 }, avatar: { width: 82, height: 82, borderRadius: 41, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: colors.primary, fontSize: 34, fontWeight: '800' }, name: { color: colors.textPrimary, fontSize: 25, fontWeight: '800', marginTop: 16, textAlign: 'center' }, email: { color: colors.textSecondary, fontSize: 16, marginTop: 6 }, status: { color: colors.primaryDark, backgroundColor: colors.primaryLight, fontSize: 14, fontWeight: '800', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginTop: 16 }, input: { minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, color: colors.textPrimary, backgroundColor: colors.surface }, button: { minWidth: 170, minHeight: 54, marginTop: 12, borderRadius: 14, borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, buttonText: { color: colors.primary, fontSize: 17, fontWeight: '800' } });
