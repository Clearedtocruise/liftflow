import { router, Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { TabQuickAddButton } from '@/components/navigation/TabQuickAddButton';
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
      {/* Centre slot. `explore` is an unused route, borrowed so the button occupies a real tab
          position instead of being absolutely positioned over the bar. */}
      <Tabs.Screen
        name="explore"
        options={{
          title: '',
          tabBarButton: () => (
            <TabQuickAddButton onPress={() => router.push('/(features)/quick-add')} />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: ({ color, focused }) => (
            <AppSymbol
              name="chart.line.uptrend.xyaxis"
              fallback={SYMBOL_FALLBACKS['chart.line.uptrend.xyaxis']}
              size={focused ? 24 : 22}
              tintColor={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          title: 'Nutrition',
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
      {/* Reachable from the dashboard: History via the streak pill, Settings via the header gear. */}
      <Tabs.Screen
        name="history"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="coaching"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
