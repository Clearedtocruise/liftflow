import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { LiftFlowWordmark } from '@/components/brand/LiftFlowWordmark';
import { LogoMark } from '@/components/brand/LogoMark';
import { AppText } from '@/components/ui/AppText';
import { Brand, LiftFlowColors, Spacing } from '@/constants/theme';

type BrandBootScreenProps = {
  message?: string;
};

/** Branded splash while auth, fonts, or first paint load. */
export function BrandBootScreen({ message = 'Loading your training…' }: BrandBootScreenProps) {
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['rgba(14, 144, 255, 0.12)', LiftFlowColors.background, LiftFlowColors.background]}
        style={StyleSheet.absoluteFill}
      />
      <LogoMark size={96} glow animate />
      <LiftFlowWordmark size="lg" showTagline />
      <AppText variant="footnote" color="textSecondary" align="center" style={styles.message}>
        {message}
      </AppText>
      <ActivityIndicator color={LiftFlowColors.primary} style={styles.spinner} />
      <AppText variant="caption" color="textTertiary" align="center">
        {Brand.name}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LiftFlowColors.background,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  message: {
    marginTop: Spacing.sm,
    maxWidth: 280,
  },
  spinner: {
    marginTop: Spacing.sm,
  },
});
