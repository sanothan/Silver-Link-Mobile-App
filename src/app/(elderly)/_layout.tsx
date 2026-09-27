import { Tabs } from 'expo-router';
import { tabOptions, tabScreenOptions } from '../../components/TabBar';

export default function ElderlyTabLayout() {
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen name="index" options={tabOptions('Home', '⌂')} />
      <Tabs.Screen name="request" options={tabOptions('Request', '+')} />
      <Tabs.Screen name="visits" options={tabOptions('Visits', '▣')} />
      <Tabs.Screen name="alerts" options={tabOptions('Alerts', '✉')} />
      <Tabs.Screen name="profile" options={tabOptions('Profile', '○')} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="caregiver-connections" options={{ href: null }} />
      <Tabs.Screen name="request-details/[id]" options={{ href: null }} />
      <Tabs.Screen name="edit-request/[id]" options={{ href: null }} />
      <Tabs.Screen name="activity-review/[requestId]" options={{ href: null }} />
      <Tabs.Screen name="volunteer-profile/[requestId]" options={{ href: null }} />
    </Tabs>
  );
}
