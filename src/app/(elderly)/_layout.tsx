import { Tabs } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { colors } from '../../theme/colors';

const icons = { index: '⌂', request: '+', visits: '▣', alerts: '!', profile: '○' } as const;

export default function ElderlyTabLayout() {
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.textSecondary, tabBarLabelStyle: styles.label, tabBarStyle: styles.bar, tabBarItemStyle: styles.item }}>
    <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>{icons.index}</Text> }} />
    <Tabs.Screen name="request" options={{ title: 'Request', tabBarIcon: ({ color }) => <Text style={[styles.requestIcon, { backgroundColor: color }]}>+</Text> }} />
    <Tabs.Screen name="visits" options={{ title: 'Visits', tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>{icons.visits}</Text> }} />
    <Tabs.Screen name="alerts" options={{ title: 'Alerts', tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>{icons.alerts}</Text> }} />
    <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>{icons.profile}</Text> }} />
  </Tabs>;
}

const styles = StyleSheet.create({
  bar: { height: 76, paddingTop: 7, paddingBottom: 9, backgroundColor: colors.surface, borderTopColor: colors.border },
  item: { minHeight: 58 },
  label: { fontSize: 13, lineHeight: 17, fontWeight: '700' },
  icon: { fontSize: 24, lineHeight: 27, fontWeight: '800' },
  requestIcon: { width: 32, height: 32, borderRadius: 16, overflow: 'hidden', color: colors.textOnPrimary, fontSize: 24, lineHeight: 30, textAlign: 'center', fontWeight: '700' },
});
