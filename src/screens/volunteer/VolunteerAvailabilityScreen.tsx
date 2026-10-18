import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { createAvailability, getVolunteerAvailability, removeAvailability, updateAvailability } from '../../services/volunteerAvailabilityService';
import { overlapsAvailability } from '../../services/volunteerAvailabilityValidation';
import { colors } from '../../theme/colors';
import { VOLUNTEER_ACTIVITY_TYPES, VOLUNTEER_DURATION_PREFERENCES, type CreateAvailabilityData, type VolunteerAvailability } from '../../types/volunteer';

type LoadingState = 'loading' | 'ready' | 'error';
type FormState = { date: string; startTime: string; endTime: string; preferredActivityTypes: string[]; preferredDuration: string | null };

const EMPTY_FORM: FormState = { date: '', startTime: '09:00', endTime: '13:00', preferredActivityTypes: [], preferredDuration: null };
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function parseDate(value: string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null; const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) || dateKey(date) !== value ? null : date; }
function startOfToday() { const today = new Date(); today.setHours(0, 0, 0, 0); return today; }
function timeValue(value: string) { const [hour, minute] = value.split(':').map(Number); return hour * 60 + minute; }
function displayTime(value: string) { if (!TIME_PATTERN.test(value)) return value; const [hour, minute] = value.split(':').map(Number); return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`; }
function formatDate(date: Date) { return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(date); }
function duration(start: string, end: string) { const minutes = timeValue(end) - timeValue(start); return minutes % 60 === 0 ? `${minutes / 60} hour${minutes === 60 ? '' : 's'}` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`; }

export default function VolunteerAvailabilityScreen() {
  const { user } = useAuth();
  const [state, setState] = useState<LoadingState>('loading');
  const [records, setRecords] = useState<VolunteerAvailability[]>([]);
  const [editing, setEditing] = useState<VolunteerAvailability | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setState('loading');
    try { setRecords(await getVolunteerAvailability(user.uid)); setState('ready'); }
    catch { setState('error'); }
  }, [user]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const upcomingRecords = useMemo(() => records.filter((record) => record.date >= startOfToday()), [records]);
  const activeRecords = useMemo(() => upcomingRecords.filter((record) => record.isAvailable), [upcomingRecords]);

  function openCreate() { setEditing(null); setForm({ ...EMPTY_FORM, date: dateKey(startOfToday()) }); setFormError(null); setMessage(null); setFormOpen(true); }
  function openEdit(record: VolunteerAvailability) { setEditing(record); setForm({ date: dateKey(record.date), startTime: record.startTime, endTime: record.endTime, preferredActivityTypes: record.preferredActivityTypes ?? [], preferredDuration: record.preferredDuration ?? null }); setFormError(null); setMessage(null); setFormOpen(true); }
  function togglePreference(preference: string) { setForm((current) => ({ ...current, preferredActivityTypes: current.preferredActivityTypes.includes(preference) ? current.preferredActivityTypes.filter((item) => item !== preference) : [...current.preferredActivityTypes, preference] })); }
  function validate(): { values: CreateAvailabilityData } | null {
    const date = parseDate(form.date);
    if (!date) { setFormError('Please select a date in YYYY-MM-DD format.'); return null; }
    if (date < startOfToday()) { setFormError('Please choose today or a future date.'); return null; }
    if (!TIME_PATTERN.test(form.startTime)) { setFormError('Please enter a valid start time in 24-hour HH:MM format.'); return null; }
    if (!TIME_PATTERN.test(form.endTime)) { setFormError('Please enter a valid end time in 24-hour HH:MM format.'); return null; }
    if (timeValue(form.endTime) <= timeValue(form.startTime)) { setFormError('End time must be after start time.'); return null; }
    const overlaps = overlapsAvailability({ date, startTime: form.startTime, endTime: form.endTime }, activeRecords, editing?.id);
    if (overlaps) { setFormError('This time overlaps with another availability you already added.'); return null; }
    return { values: { date, startTime: form.startTime, endTime: form.endTime, preferredActivityTypes: form.preferredActivityTypes, preferredDuration: form.preferredDuration } };
  }
  async function save() {
    if (!user || saving) return;
    setFormError(null); const result = validate(); if (!result) return;
    setSaving(true);
    try {
      if (editing) { await updateAvailability(user.uid, editing.id, result.values); setMessage('Availability updated.'); }
      else { await createAvailability(user.uid, result.values); setMessage('Availability saved.'); }
      setFormOpen(false); setEditing(null); await load();
    } catch { setFormError('We couldn’t save your availability. Please try again.'); }
    finally { setSaving(false); }
  }
  function confirmRemove(record: VolunteerAvailability) {
    Alert.alert('Remove this availability?', 'You may stop seeing volunteering opportunities for this time period.', [{ text: 'Keep', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => { void remove(record); } }]);
  }
  async function remove(record: VolunteerAvailability) {
    if (!user) return;
    try { await removeAvailability(user.uid, record.id); setMessage('Availability removed.'); await load(); }
    catch { setMessage('We couldn’t remove this availability. Please try again.'); }
  }

  if (state === 'loading') return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.centerText}>Loading your availability…</Text></View></SafeAreaView>;
  if (state === 'error') return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={styles.errorTitle}>We couldn’t load your availability.</Text><Text style={styles.centerText}>Please try again.</Text><Pressable accessibilityRole="button" style={styles.primaryButton} onPress={() => void load()}><Text style={styles.primaryButtonText}>Try Again</Text></Pressable></View></SafeAreaView>;

  return <SafeAreaView style={styles.safe} edges={['top']}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
    <Text style={styles.title}>My Availability</Text><Text style={styles.subtitle}>Set the times you are available to help elderly people.</Text>
    {message ? <View accessibilityRole="alert" style={styles.notice}><Text style={styles.noticeText}>{message}</Text></View> : null}
    {!formOpen ? <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={openCreate}><Text style={styles.primaryButtonText}>Add Availability</Text></Pressable> : <View style={styles.formCard}>
      <View style={styles.formHeading}><View><Text style={styles.formTitle}>{editing ? 'Edit Availability' : 'Add Availability'}</Text><Text style={styles.formHint}>Times use the 24-hour format, for example 09:00.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close availability form" style={styles.closeButton} onPress={() => setFormOpen(false)}><Text style={styles.closeText}>×</Text></Pressable></View>
      <Text style={styles.label}>Date</Text><View style={styles.dateShortcuts}><Pressable accessibilityRole="button" style={styles.dateShortcut} onPress={() => setForm((current) => ({ ...current, date: dateKey(startOfToday()) }))}><Text style={styles.dateShortcutText}>Today</Text></Pressable><Pressable accessibilityRole="button" style={styles.dateShortcut} onPress={() => { const tomorrow = startOfToday(); tomorrow.setDate(tomorrow.getDate() + 1); setForm((current) => ({ ...current, date: dateKey(tomorrow) })); }}><Text style={styles.dateShortcutText}>Tomorrow</Text></Pressable></View><TextInput accessibilityLabel="Availability date in YYYY-MM-DD format" style={styles.input} value={form.date} onChangeText={(date) => setForm((current) => ({ ...current, date }))} placeholder="YYYY-MM-DD" placeholderTextColor={colors.inputPlaceholder} autoCapitalize="none" />
      <View style={styles.timeRow}><View style={styles.timeField}><Text style={styles.label}>Start Time</Text><TextInput accessibilityLabel="Start time in 24-hour HH:MM format" style={styles.input} value={form.startTime} onChangeText={(startTime) => setForm((current) => ({ ...current, startTime }))} placeholder="09:00" placeholderTextColor={colors.inputPlaceholder} keyboardType="numbers-and-punctuation" /></View><View style={styles.timeField}><Text style={styles.label}>End Time</Text><TextInput accessibilityLabel="End time in 24-hour HH:MM format" style={styles.input} value={form.endTime} onChangeText={(endTime) => setForm((current) => ({ ...current, endTime }))} placeholder="13:00" placeholderTextColor={colors.inputPlaceholder} keyboardType="numbers-and-punctuation" /></View></View>
      <Text style={styles.label}>Preferred Activity Types <Text style={styles.optional}>(optional)</Text></Text><View style={styles.chips}>{VOLUNTEER_ACTIVITY_TYPES.map((item) => <Pressable key={item} accessibilityRole="checkbox" accessibilityState={{ checked: form.preferredActivityTypes.includes(item) }} style={[styles.chip, form.preferredActivityTypes.includes(item) && styles.chipSelected]} onPress={() => togglePreference(item)}><Text style={[styles.chipText, form.preferredActivityTypes.includes(item) && styles.chipTextSelected]}>{item}</Text></Pressable>)}</View>
      <Text style={styles.label}>Preferred Activity Duration <Text style={styles.optional}>(optional)</Text></Text><View style={styles.chips}>{VOLUNTEER_DURATION_PREFERENCES.map((item) => <Pressable key={item} accessibilityRole="radio" accessibilityState={{ checked: form.preferredDuration === item }} style={[styles.chip, form.preferredDuration === item && styles.chipSelected]} onPress={() => setForm((current) => ({ ...current, preferredDuration: current.preferredDuration === item ? null : item }))}><Text style={[styles.chipText, form.preferredDuration === item && styles.chipTextSelected]}>{item}</Text></Pressable>)}</View>
      {formError ? <View accessibilityRole="alert" style={styles.errorBox}><Text style={styles.errorBoxText}>{formError}</Text></View> : null}<Pressable accessibilityRole="button" accessibilityState={{ busy: saving }} disabled={saving} style={[styles.primaryButton, saving && styles.disabled]} onPress={() => void save()}>{saving ? <ActivityIndicator color={colors.textOnPrimary} /> : <Text style={styles.primaryButtonText}>{editing ? 'Save Changes' : 'Save Availability'}</Text>}</Pressable>
    </View>}
    <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Upcoming Availability</Text>{activeRecords.length ? <Text style={styles.count}>{activeRecords.length} active</Text> : null}</View>
    {!upcomingRecords.length ? <View style={styles.card}><Text style={styles.emptyTitle}>No availability added yet</Text><Text style={styles.bodyText}>Add your available time to discover volunteering opportunities that fit your schedule.</Text><Pressable accessibilityRole="button" style={styles.outlineButton} onPress={openCreate}><Text style={styles.outlineButtonText}>Add Availability</Text></Pressable></View> : <View style={styles.list}>{upcomingRecords.map((record) => <View key={record.id} style={styles.card}><View style={styles.cardHeader}><Text style={styles.dateTitle}>{formatDate(record.date)}</Text><View style={[styles.status, record.isAvailable ? styles.statusAvailable : styles.statusUnavailable]}><Text style={[styles.statusText, record.isAvailable ? styles.statusAvailableText : styles.statusUnavailableText]}>{record.isAvailable ? 'Available' : 'Unavailable'}</Text></View></View><Text style={styles.timeText}>{displayTime(record.startTime)} – {displayTime(record.endTime)}</Text><Text style={styles.durationText}>{duration(record.startTime, record.endTime)}</Text>{record.preferredActivityTypes?.length ? <View style={styles.preferenceRow}>{record.preferredActivityTypes.map((item) => <Text key={item} style={styles.preference}>{item}</Text>)}</View> : null}{record.preferredDuration ? <Text style={styles.preference}>Preferred duration: {record.preferredDuration}</Text> : null}{record.isAvailable ? <View style={styles.actions}><Pressable accessibilityRole="button" style={styles.editButton} onPress={() => openEdit(record)}><Text style={styles.editButtonText}>Edit</Text></Pressable><Pressable accessibilityRole="button" style={styles.removeButton} onPress={() => confirmRemove(record)}><Text style={styles.removeButtonText}>Remove</Text></Pressable></View> : <Text style={styles.unavailableNote}>Removed availability is kept for record history.</Text>}</View>)}</View>}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, content: { padding: 20, paddingBottom: 32 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 }, centerText: { color: colors.textSecondary, fontSize: 16, lineHeight: 24, textAlign: 'center' }, errorTitle: { color: colors.textPrimary, fontSize: 22, lineHeight: 30, fontWeight: '800', textAlign: 'center' }, title: { color: colors.textPrimary, fontSize: 28, lineHeight: 35, fontWeight: '800' }, subtitle: { color: colors.textSecondary, fontSize: 16, lineHeight: 24, marginTop: 6, marginBottom: 20 }, notice: { backgroundColor: colors.successLight, borderRadius: 14, padding: 14, marginBottom: 15 }, noticeText: { color: colors.success, fontSize: 15, lineHeight: 21, fontWeight: '700' }, primaryButton: { minHeight: 54, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, marginTop: 10 }, primaryButtonText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '800' }, disabled: { opacity: 0.65 }, formCard: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 17, marginBottom: 27 }, formHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 16 }, formTitle: { color: colors.textPrimary, fontSize: 20, lineHeight: 26, fontWeight: '800' }, formHint: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 3, maxWidth: 265 }, closeButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, closeText: { color: colors.textSecondary, fontSize: 30, lineHeight: 32 }, label: { color: colors.textPrimary, fontSize: 15, lineHeight: 21, fontWeight: '800', marginTop: 13, marginBottom: 7 }, optional: { color: colors.textSecondary, fontWeight: '600' }, input: { minHeight: 52, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, borderRadius: 13, paddingHorizontal: 14, color: colors.textPrimary, fontSize: 16 }, dateShortcuts: { flexDirection: 'row', gap: 9, marginBottom: 8 }, dateShortcut: { minHeight: 39, borderRadius: 11, backgroundColor: colors.primaryLight, paddingHorizontal: 13, justifyContent: 'center' }, dateShortcutText: { color: colors.primary, fontSize: 14, fontWeight: '800' }, timeRow: { flexDirection: 'row', gap: 11 }, timeField: { flex: 1 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { minHeight: 39, borderWidth: 1, borderColor: colors.borderDark, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12, justifyContent: 'center' }, chipSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight }, chipText: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' }, chipTextSelected: { color: colors.primary }, errorBox: { backgroundColor: colors.errorLight, borderRadius: 12, padding: 12, marginTop: 14 }, errorBoxText: { color: colors.error, fontSize: 14, lineHeight: 20, fontWeight: '700' }, sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, marginBottom: 11 }, sectionTitle: { color: colors.textPrimary, fontSize: 20, lineHeight: 26, fontWeight: '800' }, count: { color: colors.primary, backgroundColor: colors.primaryLight, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, fontSize: 13, fontWeight: '800' }, list: { gap: 12 }, card: { backgroundColor: colors.surface, borderRadius: 18, padding: 17, borderWidth: 1, borderColor: colors.border }, cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 9, alignItems: 'flex-start' }, dateTitle: { flex: 1, color: colors.textPrimary, fontSize: 18, lineHeight: 24, fontWeight: '800' }, status: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 }, statusAvailable: { backgroundColor: colors.successLight }, statusUnavailable: { backgroundColor: colors.surfaceSoft }, statusText: { fontSize: 12, lineHeight: 16, fontWeight: '800' }, statusAvailableText: { color: colors.success }, statusUnavailableText: { color: colors.textSecondary }, timeText: { color: colors.textPrimary, fontSize: 16, lineHeight: 23, fontWeight: '700', marginTop: 10 }, durationText: { color: colors.textSecondary, fontSize: 15, lineHeight: 21, marginTop: 3 }, preferenceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }, preference: { color: colors.primaryDark, fontSize: 13, lineHeight: 19, fontWeight: '700', backgroundColor: colors.primaryLight, alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginTop: 8 }, actions: { flexDirection: 'row', gap: 10, marginTop: 15 }, editButton: { flex: 1, minHeight: 46, borderRadius: 12, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }, editButtonText: { color: colors.primary, fontSize: 15, fontWeight: '800' }, removeButton: { flex: 1, minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.error, alignItems: 'center', justifyContent: 'center' }, removeButtonText: { color: colors.error, fontSize: 15, fontWeight: '800' }, unavailableNote: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 14 }, emptyTitle: { color: colors.textPrimary, fontSize: 18, lineHeight: 24, fontWeight: '800' }, bodyText: { color: colors.textSecondary, fontSize: 16, lineHeight: 23, marginTop: 6 }, outlineButton: { minHeight: 48, alignSelf: 'flex-start', borderRadius: 13, borderWidth: 2, borderColor: colors.primary, paddingHorizontal: 17, justifyContent: 'center', marginTop: 15 }, outlineButtonText: { color: colors.primary, fontSize: 15, fontWeight: '800' },
});
