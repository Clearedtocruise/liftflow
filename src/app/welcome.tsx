import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LiftFlowWordmark } from '@/components/brand/LiftFlowWordmark';
import { LogoMark } from '@/components/brand/LogoMark';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { Brand, LiftFlowColors, Spacing, TouchTarget } from '@/constants/theme';

const LOGO_SIZE = 140;

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['rgba(31, 107, 255, 0.18)', 'rgba(8, 11, 16, 0.35)', LiftFlowColors.background]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['transparent', 'rgba(0, 229, 255, 0.05)', 'transparent']}
        start={{ x: 0, y: 0.45 }}
        end={{ x: 1, y: 0.55 }}
        style={styles.horizonGlow}
      />

      <View
        style={[
          styles.content,
          { paddingTop: insets.top + Spacing.xxxl, paddingBottom: insets.bottom + Spacing.xl },
        ]}>
        <Animated.View entering={FadeIn.duration(700)} style={styles.hero}>
          <LogoMark size={LOGO_SIZE} glow animate />

          <Animated.View entering={FadeInDown.delay(200).duration(560)} style={styles.brandBlock}>
            <LiftFlowWordmark size="lg" showTagline />
          </Animated.View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(360).duration(560)} style={styles.copy}>
          <AppText variant="headline" align="center" style={styles.headline}>
            {Brand.heroHeadline}
          </AppText>
          <AppText variant="body" color="textSecondary" align="center">
            Training, nutrition, and recovery that adapt to you — every session.
          </AppText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(500).duration(560)} style={styles.actions}>
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
    opacity: 0.95,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xxl,
    justifyContent: 'space-between',
  },
  hero: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
  },
  brandBlock: {
    alignItems: 'center',
    marginTop: Spacing.xxxl + Spacing.md,
    gap: Spacing.md,
  },
  copy: {
    gap: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  headline: {
    letterSpacing: 0.6,
  },
  actions: {
    gap: Spacing.lg,
  },
  signIn: {
    minHeight: TouchTarget.min,
    justifyContent: 'center',
  },
});
