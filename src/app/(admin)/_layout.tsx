import { Tabs } from 'expo-router';
import { tabOptions, tabScreenOptions } from '../../components/TabBar';

export default function AdminTabLayout() {
  return <Tabs screenOptions={tabScreenOptions}>
    <Tabs.Screen name="index" options={tabOptions('Home', '⌂')} />
    <Tabs.Screen name="users" options={tabOptions('Users', '◎')} />
    <Tabs.Screen name="requests" options={tabOptions('Requests', '☰')} />
    <Tabs.Screen name="verify" options={tabOptions('Verify', '✓')} />
    <Tabs.Screen name="reports" options={tabOptions('Reports', '!')} />
    <Tabs.Screen name="profile" options={tabOptions('Profile', '○')} />
  </Tabs>;
}
