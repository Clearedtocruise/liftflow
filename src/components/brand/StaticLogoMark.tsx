import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';

import { LiftFlowColors, Spacing } from '@/constants/theme';

type StaticLogoMarkProps = {
  size?: number;
};

const iconSource = require('../../../assets/branding/one-more-icon-256.png');

/** Splash/login logo — PNG only, no SVG/Reanimated/LinearGradient. */
export function StaticLogoMark({ size = 64 }: StaticLogoMarkProps) {
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Image source={iconSource} style={{ width: size, height: size }} resizeMode="contain" />
    </View>
  );
}

export function StaticSplash() {
  return (
    <View style={styles.splash}>
      <StaticLogoMark size={80} />
      <ActivityIndicator color={LiftFlowColors.primary} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LiftFlowColors.background,
  },
  spinner: {
    marginTop: Spacing.xl,
  },
});
