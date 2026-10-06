import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '@/providers/language-provider';
import { useAppTheme } from '@/theme/theme';
import { tabBarLayout } from '@/utils/tab-bar';

type IconName = ComponentProps<typeof Ionicons>['name'];

function TabIcon({ active, icon, iconActive }: { active: boolean; icon: IconName; iconActive: IconName }) {
  const theme = useAppTheme();
  return (
    <View style={[styles.iconPill, active && { backgroundColor: theme.accentSurfaceStrong }]}>
      <Ionicons color={active ? theme.accentSoft : theme.textMuted} name={active ? iconActive : icon} size={21} />
    </View>
  );
}

export default function TabsLayout() {
  const { t } = useLanguage();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const bar = tabBarLayout(insets.bottom);
  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.background },
        tabBarActiveTintColor: theme.text,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: bar.bottom,
          height: bar.height,
          borderRadius: 28,
          borderTopWidth: 1,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.surface,
          paddingTop: 7,
          paddingBottom: 9,
          shadowColor: theme.shadow,
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: theme.dark ? 0.34 : 0.12,
          shadowRadius: 24,
          elevation: 12,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
        tabBarItemStyle: { borderRadius: 20 },
      }}
    >
      <Tabs.Screen name="home" options={{ title: t('tabHome'), tabBarIcon: ({ focused }) => <TabIcon active={focused} icon="home-outline" iconActive="home" /> }} />
      <Tabs.Screen name="today" options={{ title: t('tabToday'), tabBarIcon: ({ focused }) => <TabIcon active={focused} icon="list-circle-outline" iconActive="list-circle" /> }} />
      <Tabs.Screen name="inbox" options={{ title: t('tabInbox'), tabBarIcon: ({ focused }) => <TabIcon active={focused} icon="file-tray-outline" iconActive="file-tray-full" /> }} />
      <Tabs.Screen name="calendar" options={{ title: t('tabCalendar'), tabBarIcon: ({ focused }) => <TabIcon active={focused} icon="calendar-clear-outline" iconActive="calendar" /> }} />
      <Tabs.Screen name="projects" options={{ title: t('tabProjects'), tabBarIcon: ({ focused }) => <TabIcon active={focused} icon="grid-outline" iconActive="grid" /> }} />
      <Tabs.Screen name="agenda" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconPill: { alignItems: 'center', borderRadius: 13, height: 30, justifyContent: 'center', width: 42 },
});
