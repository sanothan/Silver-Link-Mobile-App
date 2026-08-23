import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme/colors';
import type { RequestFormValues } from '../types/request';

const ACTIVITIES = ['Friendly Conversation', 'Walking Companionship', 'Smartphone Help', 'Grocery Collection', 'Medicine Collection', 'Online Service Help', 'Appointment Companionship', 'Other'];
const DURATIONS = [{ label: '30 minutes', minutes: 30 }, { label: '1 hour', minutes: 60 }, { label: '1–2 hours', minutes: 90 }, { label: 'Flexible', minutes: undefined }];
const dateText = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function RequestForm({ initial, submitLabel, saving, onSubmit }: { initial?: RequestFormValues; submitLabel: string; saving: boolean; onSubmit: (values: RequestFormValues) => Promise<void> }) {
  const [activityType, setActivityType] = useState(initial?.activityType ?? ''); const [description, setDescription] = useState(initial?.description ?? '');
  const [date, setDate] = useState(initial ? dateText(initial.preferredDate) : ''); const [time, setTime] = useState(initial?.preferredTime ?? '');
  const [durationLabel, setDurationLabel] = useState(initial?.durationLabel ?? '1 hour'); const [location, setLocation] = useState(initial?.location ?? ''); const [error, setError] = useState('');
  const selectedDuration = useMemo(() => DURATIONS.find((item) => item.label === durationLabel), [durationLabel]);

  async function submit() {
    setError('');
    if (!activityType) return setError('Please choose an activity.');
    const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00`) : null;
    if (!parsedDate || Number.isNaN(parsedDate.getTime())) return setError('Please enter a valid date as YYYY-MM-DD.');
    const today = new Date(); today.setHours(0, 0, 0, 0); if (parsedDate < today) return setError('Please choose today or a future date.');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return setError('Please enter a valid time as HH:MM.');
    if (!location.trim()) return setError('Please enter a location.');
    if (description.length > 500) return setError('Please keep the description under 500 characters.');
    await onSubmit({ activityType, description, preferredDate: parsedDate, preferredTime: time, durationMinutes: selectedDuration?.minutes, durationLabel, location, latitude: initial?.latitude, longitude: initial?.longitude });
  }

  return <View style={styles.form}><Text style={styles.label}>Choose an activity</Text><View style={styles.chips}>{ACTIVITIES.map((item) => <Pressable key={item} accessibilityRole="radio" accessibilityState={{ checked: activityType === item }} onPress={() => setActivityType(item)} style={[styles.chip, activityType === item && styles.chipActive]}><Text style={[styles.chipText, activityType === item && styles.chipTextActive]}>{item}</Text></Pressable>)}</View>
    <Field label="Tell us what you need help with" value={description} onChangeText={setDescription} placeholder="I need help collecting medicine from the nearby pharmacy." multiline />
    <View style={styles.row}><View style={styles.flex}><Field label="Preferred date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" /></View><View style={styles.flex}><Field label="Preferred time" value={time} onChangeText={setTime} placeholder="10:00" /></View></View>
    <Text style={styles.label}>Duration</Text><View style={styles.chips}>{DURATIONS.map((item) => <Pressable key={item.label} accessibilityRole="radio" accessibilityState={{ checked: durationLabel === item.label }} onPress={() => setDurationLabel(item.label)} style={[styles.chip, durationLabel === item.label && styles.chipActive]}><Text style={[styles.chipText, durationLabel === item.label && styles.chipTextActive]}>{item.label}</Text></Pressable>)}</View>
    <Field label="Location" value={location} onChangeText={setLocation} placeholder="Your locality or meeting place" />
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: saving, busy: saving }} disabled={saving} style={[styles.button, saving && styles.disabled]} onPress={() => void submit()}>{saving ? <ActivityIndicator color={colors.textOnPrimary} /> : <Text style={styles.buttonText}>{submitLabel}</Text>}</Pressable>
  </View>;
}

function Field({ label, multiline, ...props }: { label: string; multiline?: boolean; value: string; onChangeText: (value: string) => void; placeholder: string }) { return <View><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} {...props} multiline={multiline} maxLength={multiline ? 500 : undefined} placeholderTextColor={colors.inputPlaceholder} style={[styles.input, multiline && styles.multiline]} /></View>; }
const styles = StyleSheet.create({ form: { gap: 16 }, label: { color: colors.textPrimary, fontSize: 16, lineHeight: 22, fontWeight: '800', marginBottom: 7 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, chip: { minHeight: 50, borderWidth: 1, borderColor: colors.borderDark, borderRadius: 14, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }, chipActive: { borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.primaryLight }, chipText: { color: colors.textSecondary, fontSize: 15, fontWeight: '700' }, chipTextActive: { color: colors.primaryDark }, input: { minHeight: 54, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 14, backgroundColor: colors.surface, paddingHorizontal: 15, color: colors.textPrimary, fontSize: 17 }, multiline: { minHeight: 112, paddingTop: 14, textAlignVertical: 'top' }, row: { flexDirection: 'row', gap: 11 }, flex: { flex: 1 }, error: { color: colors.error, backgroundColor: colors.errorLight, borderRadius: 12, padding: 12, fontSize: 15, lineHeight: 21 }, button: { minHeight: 58, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 5 }, buttonText: { color: colors.textOnPrimary, fontSize: 18, fontWeight: '800' }, disabled: { opacity: 0.65 } });
