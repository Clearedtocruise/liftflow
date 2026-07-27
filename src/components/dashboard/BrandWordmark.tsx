import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';

/**
 * The header lockup: "ONE MORE" over a letterspaced "FITNESS".
 *
 * Drawn as text rather than shipped as an image so it stays crisp at any density and inherits the
 * app's font loading, which an SVG or PNG wordmark would not.
 */
export function BrandWordmark() {
  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel="ONE MORE Fitness"
      style={styles.root}>
      <AppText variant="bodyBold" style={styles.primary}>
        ONE
      </AppText>
      <AppText variant="bodyBold" style={styles.primary}>
        MORE
      </AppText>
      <AppText variant="label" style={styles.secondary}>
        FITNESS
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'flex-end',
  },
  primary: {
    color: LiftFlowColors.restTimer,
    fontSize: 17,
    lineHeight: 18,
    letterSpacing: 1.2,
  },
  secondary: {
    color: LiftFlowColors.textTertiary,
    fontSize: 8,
    letterSpacing: Spacing.xs,
  },
});
