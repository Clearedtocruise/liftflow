import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { FeaturePlaceholderScreen } from '@/components/features/FeaturePlaceholderScreen';
import { AppText } from '@/components/ui/AppText';
import { FEATURE_MAP } from '@/constants/features';
import { LiftFlowColors } from '@/constants/theme';

import AppleWatchScreen from './apple-watch';
import CardioTrackingScreen from './cardio-tracking';
import NutritionPreferencesScreen from './nutrition-preferences';
import EquipmentScreen from './equipment';
import HealthKitScreen from './healthkit';
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
      <View style={styles.error}>
        <AppText variant="headline">Feature Not Found</AppText>
        <AppText variant="body" color="textSecondary">
          Unknown feature: {feature}
        </AppText>
      </View>
    );
  }

  return <FeaturePlaceholderScreen feature={definition} />;
}

const styles = StyleSheet.create({
  error: {
    flex: 1,
    backgroundColor: LiftFlowColors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
