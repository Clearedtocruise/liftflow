import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { FeaturePlaceholderScreen } from '@/components/features/FeaturePlaceholderScreen';
import { AppText } from '@/components/ui/AppText';
import { FEATURE_MAP } from '@/constants/features';
import { LiftFlowColors } from '@/constants/theme';

/**
 * Dynamic feature route — renders placeholder for any registered future feature.
 * Route: /(features)/[feature] e.g. /(features)/ai-coaching
 *
 * Slugs that have their own file in this directory never reach here: expo-router matches the
 * static route first, so re-exporting those screens from this file only created dead branches.
 */
export default function FeatureScreen() {
  const { feature } = useLocalSearchParams<{ feature: string }>();

  const definition = feature ? FEATURE_MAP[feature] : undefined;

  if (!definition) {
    return (
      <View style={styles.error}>
        <AppText variant="headline">This isn&apos;t available yet</AppText>
        <AppText variant="body" color="textSecondary" align="center">
          We couldn&apos;t find that feature. Head back and try another one.
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
