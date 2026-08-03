import { Stack } from 'expo-router';

import { LiftFlowColors } from '@/constants/theme';

/**
 * Without an explicit title expo-router falls back to the filename, so these screens shipped
 * headers reading "coach-chat" and "peak-music-settings".
 */
const SCREEN_TITLES: Record<string, string> = {
  '[feature]': 'Feature',
  'apple-watch': 'Apple Watch',
  'cardio-tracking': 'Cardio & HIIT',
  'coach-chat': 'ONE MORE Coach',
  equipment: 'Gym Equipment',
  healthkit: 'Health & Strava',
  limitations: 'What ONE MORE Can Do',
  'log-activity': 'Log Activity',
  'manage-subscription': 'Manage Subscription',
  'next-week-plan': 'Next Week',
  'nutrition-intelligence': 'Nutrition Intelligence',
  'nutrition-preferences': 'Nutrition Preferences',
  'peak-music-settings': 'Peak Music Sync',
  'program-calendar': 'Program Calendar',
  'program-create': 'New Program',
  program: 'Your Program',
  'quick-add': 'Add',
  'recovery-analysis': 'Recovery Analysis',
  'recovery-check-in': 'Body Check-In',
  'release-notes': 'Release Notes',
  'send-feedback': 'Send Feedback',
  subscription: 'ONE MORE Pro',
  'suggested-workouts': 'Suggested Workouts',
  'training-goals': 'Training Goals',
  'training-profile': 'Workout Locations',
  'training-schedule': 'Training Schedule',
  'unit-preferences': 'Units',
  upgrade: 'Upgrade',
  'weekly-check-in': 'Weekly Check-In',
  'weekly-summary': 'Weekly Summary',
};

export default function FeaturesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: LiftFlowColors.background },
        headerTintColor: LiftFlowColors.textPrimary,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: LiftFlowColors.background },
        animation: 'slide_from_right',
      }}>
      {Object.entries(SCREEN_TITLES).map(([name, title]) => (
        <Stack.Screen key={name} name={name} options={{ title }} />
      ))}
    </Stack>
  );
}
