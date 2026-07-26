import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { AppSymbol, SYMBOL_FALLBACKS } from '@/components/ui/AppSymbol';
import { LiftFlowColors, TabBarHeight, Typography } from '@/constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: LiftFlowColors.tabActive,
        tabBarInactiveTintColor: LiftFlowColors.tabInactive,
        tabBarStyle: {
          backgroundColor: LiftFlowColors.tabBar,
          borderTopColor: LiftFlowColors.border,
          borderTopWidth: 1,
          height: TabBarHeight,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 24 : 12,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          ...Typography.caption,
          marginTop: 2,
          fontSize: 10,
        },
        sceneStyle: {
          backgroundColor: LiftFlowColors.background,
        },
      }}>
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
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
          title: 'Nutritional',
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
