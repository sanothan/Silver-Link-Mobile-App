import { Tabs } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { colors } from '../../theme/colors';

const icons = { index: '⌂', users: '👥', verify: '✅', reports: '⚠', profile: '●' } as const;

export default function AdminTabLayout() {
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.textSecondary, tabBarLabelStyle: styles.label, tabBarStyle: styles.bar, tabBarItemStyle: styles.item }}>
    <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>{icons.index}</Text> }} />
    <Tabs.Screen name="users" options={{ title: 'Users', tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>{icons.users}</Text> }} />
    <Tabs.Screen name="verify" options={{ title: 'Verify', tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>{icons.verify}</Text> }} />
    <Tabs.Screen name="reports" options={{ title: 'Reports', tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>{icons.reports}</Text> }} />
    <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>{icons.profile}</Text> }} />
  </Tabs>;
}

const styles = StyleSheet.create({ bar: { height: 76, paddingTop: 7, paddingBottom: 9, backgroundColor: colors.surface, borderTopColor: colors.border }, item: { minHeight: 58 }, label: { fontSize: 12, lineHeight: 16, fontWeight: '700' }, icon: { fontSize: 21, lineHeight: 25, fontWeight: '800' } });
