import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { FeaturePlaceholderScreen } from '@/components/features/FeaturePlaceholderScreen';
import { AppText } from '@/components/ui/AppText';
import { FEATURE_MAP } from '@/constants/features';
import { LiftFlowColors } from '@/constants/theme';

/**
 * Dynamic feature route — renders placeholder for any registered future feature.
 * Route: /(features)/[feature] e.g. /(features)/ai-coaching
 */
export default function FeatureScreen() {
  const { feature } = useLocalSearchParams<{ feature: string }>();
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
