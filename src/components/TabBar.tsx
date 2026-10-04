import { Platform, StyleSheet, Text, View } from 'react-native';
import type { ColorValue } from 'react-native';
import type { ComponentProps } from 'react';
import type { Tabs } from 'expo-router';
import { colors } from '../theme/colors';

type TabOptions = Exclude<NonNullable<ComponentProps<typeof Tabs.Screen>['options']>, (...args: never[]) => unknown>;

type TabIconProps = { glyph: string; color: ColorValue; focused: boolean };

// Pill-highlighted icon used by every role's bottom tab bar.
export function TabIcon({ glyph, color, focused }: TabIconProps) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Text style={[styles.icon, { color }]} accessible={false}>
        {glyph}
      </Text>
    </View>
  );
}

export function tabOptions(title: string, glyph: string): TabOptions {
  return {
    title,
    tabBarAccessibilityLabel: `${title} tab`,
    tabBarIcon: ({ color, focused }) => <TabIcon glyph={glyph} color={color} focused={focused} />,
  };
}

export const tabScreenOptions: TabOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.primaryDark,
  tabBarInactiveTintColor: colors.textMuted,
  tabBarLabelStyle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  tabBarItemStyle: { minHeight: 56, paddingTop: 4 },
  tabBarStyle: {
    height: Platform.OS === 'ios' ? 84 : 72,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 22 : 10,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 10,
  },
};

const styles = StyleSheet.create({
  iconWrap: {
    minWidth: 52,
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: { backgroundColor: colors.primaryLight },
  icon: { fontSize: 20, lineHeight: 24, fontWeight: '800' },
});
