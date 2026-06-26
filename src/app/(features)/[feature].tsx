import { useLocalSearchParams } from 'expo-router';

import { FeaturePlaceholderScreen } from '@/components/features/FeaturePlaceholderScreen';
import { EscapeScreen } from '@/components/layout/EscapeScreen';
import { FEATURE_MAP } from '@/constants/features';

import AppleWatchScreen from './apple-watch';
import CardioTrackingScreen from './cardio-tracking';
import EquipmentScreen from './equipment';
import HealthKitScreen from './healthkit';
import NutritionPreferencesScreen from './nutrition-preferences';
import SubscriptionScreen from './subscription';
import TrainingGoalsScreen from './training-goals';
import TrainingProfileScreen from './training-profile';

/**
 * Dynamic feature route — renders placeholder for any registered future feature.
 * Route: /(features)/[feature] e.g. /(features)/ai-coaching
 */
export default function FeatureScreen() {
  const { feature } = useLocalSearchParams<{ feature: string }>();

  if (feature === 'training-goals') return <TrainingGoalsScreen />;
  if (feature === 'equipment') return <EquipmentScreen />;
  if (feature === 'nutrition-preferences') return <NutritionPreferencesScreen />;
  if (feature === 'subscription') return <SubscriptionScreen />;
  if (feature === 'healthkit') return <HealthKitScreen />;
  if (feature === 'training-profile') return <TrainingProfileScreen />;
  if (feature === 'apple-watch' || feature === 'rep-counting' || feature === 'motion-detection') {
    return <AppleWatchScreen />;
  }
  if (feature === 'cardio-tracking') {
    return <CardioTrackingScreen />;
  }

  const definition = feature ? FEATURE_MAP[feature] : undefined;

  if (!definition) {
    return (
      <EscapeScreen
        title="Feature Not Found"
        message={`We couldn't find "${feature ?? 'this feature'}". Head back or return home.`}
      />
    );
  }

  return <FeaturePlaceholderScreen feature={definition} />;
}
