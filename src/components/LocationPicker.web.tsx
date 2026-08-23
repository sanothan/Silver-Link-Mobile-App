import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
export type PickedLocation = { latitude: number; longitude: number; label?: string };
export function LocationPicker(_: { value?: PickedLocation; onChange: (location: PickedLocation) => void }) { return <View style={styles.card}><Text style={styles.title}>Map selection is available in the mobile app.</Text><Text style={styles.text}>Enter the meeting location above when using SilverLink on the web.</Text></View>; }
const styles = StyleSheet.create({ card: { minHeight: 100, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSoft, padding: 16, justifyContent: 'center' }, title: { color: colors.textPrimary, fontSize: 16, fontWeight: '800' }, text: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 5 } });
