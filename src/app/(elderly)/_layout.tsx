import { Tabs } from 'expo-router';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';

import type { ColorValue } from 'react-native';

type TabIconProps = { emoji: string; color: ColorValue; focused: boolean };

function TabIcon({ emoji, color, focused }: TabIconProps) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Text style={[styles.icon, { color }]}>{emoji}</Text>
    </View>
  );
}

export default function ElderlyTabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.label,
        tabBarStyle: styles.bar,
        tabBarItemStyle: styles.item,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon emoji="⌂" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="request"
        options={{
          title: 'Request',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.requestBubble, { backgroundColor: focused ? colors.primary : colors.textMuted }]}>
              <Text style={styles.requestPlus}>+</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="visits"
        options={{
          title: 'Visits',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon emoji="▣" color={color} focused={focused} />
          ),
        }}
      />
    <Tabs.Screen name="notifications" options={{ href: null }} />
    <Tabs.Screen name="caregiver-connections" options={{ href: null }} />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon emoji="✉" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon emoji="○" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen name="request-details/[id]" options={{ href: null }} />
      <Tabs.Screen name="edit-request/[id]" options={{ href: null }} />
      <Tabs.Screen name="activity-review/[requestId]" options={{ href: null }} />
      <Tabs.Screen
        name="volunteer-profile/[requestId]"
        options={{ href: null }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: Platform.OS === 'ios' ? 84 : 72,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 22 : 10,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 10,
  },
  item: { minHeight: 56, paddingTop: 4 },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.primaryLight,
  },
  icon: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
  },
  requestBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestPlus: {
    color: colors.textOnPrimary,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
  },
});
