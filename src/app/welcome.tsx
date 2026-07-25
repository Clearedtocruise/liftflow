import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LiftFlowWordmark } from '@/components/brand/LiftFlowWordmark';
import { LogoMark } from '@/components/brand/LogoMark';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing, TouchTarget } from '@/constants/theme';

const LOGO_SIZE = 130;

const FEATURES = [
  'Personalized Workouts',
  'Adaptive Nutrition',
  'Recovery Optimization',
  'Real Results',
] as const;

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['rgba(31, 107, 255, 0.14)', 'rgba(8, 11, 16, 0.4)', LiftFlowColors.background]}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['transparent', 'rgba(0, 229, 255, 0.04)', 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.horizonGlow}
      />

      <View
        style={[
          styles.content,
          { paddingTop: insets.top + Spacing.xxxl, paddingBottom: insets.bottom + Spacing.xl },
        ]}>
        <Animated.View entering={FadeIn.duration(600)} style={styles.hero}>
          <LogoMark size={LOGO_SIZE} glow animate />

          <Animated.View entering={FadeInDown.delay(180).duration(520)} style={styles.brandBlock}>
            <LiftFlowWordmark size="lg" showTagline />
          </Animated.View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(320).duration(520)} style={styles.features}>
          {FEATURES.map((label) => (
            <View key={label} style={styles.featureRow}>
              <View style={styles.featureDot} />
              <AppText variant="footnote" color="textSecondary">
                {label}
              </AppText>
            </View>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(460).duration(520)} style={styles.actions}>
          <PrimaryButton label="GET STARTED" size="large" onPress={() => router.push('/(auth)/signup')} />
          <Pressable
            onPress={() => router.push('/(auth)/login')}
            style={styles.signIn}
            accessibilityRole="button"
            accessibilityLabel="Sign in to an existing account">
            <AppText variant="body" color="textSecondary" align="center">
              Already have an account?{' '}
              <AppText variant="bodyBold" color="accent">
                Sign In
              </AppText>
            </AppText>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LiftFlowColors.background,
  },
  horizonGlow: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.9,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xxl,
    justifyContent: 'space-between',
  },
  hero: {
    alignItems: 'center',
  },
  brandBlock: {
    alignItems: 'center',
    marginTop: Spacing.xxxl + Spacing.lg,
    gap: Spacing.md,
  },
  features: {
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  featureDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: LiftFlowColors.primary,
  },
  actions: {
    gap: Spacing.lg,
  },
  signIn: {
    minHeight: TouchTarget.min,
    justifyContent: 'center',
  },
});
