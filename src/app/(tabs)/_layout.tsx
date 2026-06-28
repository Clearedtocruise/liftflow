import { Tabs } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppSymbol, SYMBOL_FALLBACKS } from '@/components/ui/AppSymbol';
import { Typography } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';

export default function TabsLayout() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 10);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.tabActive,
        tabBarInactiveTintColor: theme.colors.tabInactive,
        tabBarStyle: {
          backgroundColor: theme.colors.tabBar,
          borderTopColor: theme.colors.tabBarBorder,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 56 + bottomPad,
          paddingTop: 6,
          paddingBottom: bottomPad,
          ...theme.shadows.tabBar,
        },
        tabBarLabelStyle: {
          ...Typography.caption,
          fontSize: 9,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarItemStyle: {
          flex: 1,
          minWidth: 0,
        },
        sceneStyle: {
          backgroundColor: theme.colors.background,
        },
      }}>
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          tabBarButtonTestID: 'home-tab',
          tabBarIcon: ({ color, focused }) => (
            <AppSymbol
              name="house.fill"
              fallback={SYMBOL_FALLBACKS['house.fill']}
              size={focused ? 24 : 22}
              tintColor={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: 'Workout',
          tabBarButtonTestID: 'workout-tab',
          tabBarIcon: ({ color, focused }) => (
            <AppSymbol
              name="figure.strengthtraining.traditional"
              fallback={SYMBOL_FALLBACKS['figure.strengthtraining.traditional']}
              size={focused ? 24 : 22}
              tintColor={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          title: 'Meals',
          tabBarButtonTestID: 'nutrition-tab',
          tabBarIcon: ({ color, focused }) => (
            <AppSymbol
              name="leaf.fill"
              fallback={SYMBOL_FALLBACKS['leaf.fill']}
              size={focused ? 24 : 22}
              tintColor={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarButtonTestID: 'progress-tab',
          tabBarIcon: ({ color, focused }) => (
            <AppSymbol
              name="camera.fill"
              fallback={SYMBOL_FALLBACKS['camera.fill']}
              size={focused ? 24 : 22}
              tintColor={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, focused }) => (
            <AppSymbol
              name="clock.arrow.circlepath"
              fallback={SYMBOL_FALLBACKS['clock.arrow.circlepath']}
              size={focused ? 24 : 22}
              tintColor={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarButtonTestID: 'settings-tab',
          tabBarIcon: ({ color, focused }) => (
            <AppSymbol
              name="gearshape.fill"
              fallback={SYMBOL_FALLBACKS['gearshape.fill']}
              size={focused ? 24 : 22}
              tintColor={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="coaching"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
