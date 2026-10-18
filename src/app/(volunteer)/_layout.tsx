import { Tabs } from 'expo-router';
import { tabOptions, tabScreenOptions } from '../../components/TabBar';

export default function VolunteerTabLayout() {
  return <Tabs screenOptions={tabScreenOptions}>
    <Tabs.Screen name="index" options={tabOptions('Home', '⌂')} />
    <Tabs.Screen name="explore" options={tabOptions('Opportunities', '⌕')} />
    <Tabs.Screen name="activities" options={tabOptions('Activity', '▣')} />
    <Tabs.Screen name="alerts" options={tabOptions('Alerts', '✉')} />
    <Tabs.Screen name="profile" options={tabOptions('Profile', '○')} />
    <Tabs.Screen name="availability" options={{ href: null }} />
    <Tabs.Screen name="request-details/[id]" options={{ href: null }} />
    <Tabs.Screen name="request-chat/[id]" options={{ href: null }} />
  </Tabs>;
}
