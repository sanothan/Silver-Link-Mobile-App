import { Tabs } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { colors } from '../../theme/colors';

const icons = { index: '⌂', explore: '⌕', activities: '□', alerts: '!', profile: '●' } as const;

export default function VolunteerTabLayout() {
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.textSecondary, tabBarLabelStyle: styles.label, tabBarStyle: styles.bar, tabBarItemStyle: styles.item }}>
    <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>{icons.index}</Text> }} />
    <Tabs.Screen name="explore" options={{ title: 'Explore', tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>{icons.explore}</Text> }} />
    <Tabs.Screen name="activities" options={{ title: 'Activities', tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>{icons.activities}</Text> }} />
    <Tabs.Screen name="alerts" options={{ title: 'Alerts', tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>{icons.alerts}</Text> }} />
    <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>{icons.profile}</Text> }} />
    <Tabs.Screen name="availability" options={{ href: null }} />
    <Tabs.Screen name="request-details/[id]" options={{ href: null }} />
    <Tabs.Screen name="request-chat/[id]" options={{ href: null }} />
  </Tabs>;
}

const styles = StyleSheet.create({ bar: { height: 76, paddingTop: 7, paddingBottom: 9, backgroundColor: colors.surface, borderTopColor: colors.border }, item: { minHeight: 58 }, label: { fontSize: 12, lineHeight: 16, fontWeight: '700' }, icon: { fontSize: 23, lineHeight: 27, fontWeight: '800' } });
