import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { LiftFlowLogo } from '@/components/brand/LiftFlowLogo';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText, textStyles } from '@/components/ui/AppText';
import { Brand, LiftFlowColors, Radius, Spacing, TouchTarget } from '@/constants/theme';

const LEGAL_ITEMS = [
  {
    title: 'Train at your own risk',
    body: 'Exercise involves risk. ONE MORE does not guarantee results.',
  },
  {
    title: 'Not medical advice',
    body: 'Guidance is informational — not medical, PT, or clinical nutrition advice.',
  },
  {
    title: 'AI can be wrong',
    body: 'Coach suggestions may be inaccurate. Check with a professional when unsure.',
  },
] as const;

export default function LegalOnboardingScreen() {
  return (
    <ScreenContainer>
      <View style={styles.brand}>
        <LiftFlowLogo size={48} variant="primary" />
        <AppText variant="label" style={styles.brandName}>
          {Brand.name}
        </AppText>
        <AppText variant="caption" color="textTertiary">
          FITNESS
        </AppText>
      </View>

      <Animated.View entering={FadeInDown.duration(360)} style={styles.header}>
        <AppText variant="title">Before we build your plan</AppText>
        <AppText variant="body" color="textSecondary">
          Quick legal check — then your coach takes over.
        </AppText>
      </Animated.View>

      <View style={styles.list}>
        {LEGAL_ITEMS.map((item, i) => (
          <Animated.View key={item.title} entering={FadeInDown.delay(80 + i * 70).duration(360)}>
            <View style={styles.cardOuter}>
              <LinearGradient
                colors={['rgba(14, 144, 255, 0.22)', 'rgba(0, 229, 255, 0.06)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardBorder}>
                <View style={styles.card}>
                  <AppText variant="callout">{item.title}</AppText>
                  <AppText variant="footnote" color="textSecondary">
                    {item.body}
                  </AppText>
                </View>
              </LinearGradient>
            </View>
          </Animated.View>
        ))}
      </View>

      <View style={styles.links}>
        <Pressable
          onPress={() => router.push('/legal/terms')}
          style={styles.link}
          accessibilityRole="button"
          accessibilityLabel="Read the Terms of Service">
          <AppText variant="footnote" style={textStyles.link}>
            Terms of Service
          </AppText>
        </Pressable>
        <Pressable
          onPress={() => router.push('/legal/privacy')}
          style={styles.link}
          accessibilityRole="button"
          accessibilityLabel="Read the Privacy Policy">
          <AppText variant="footnote" style={textStyles.link}>
            Privacy Policy
          </AppText>
        </Pressable>
      </View>

      <PrimaryButton
        label="I accept — build my plan"
        size="large"
        onPress={() => router.push('/(onboarding)/profile')}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  brand: {
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.xl,
  },
  brandName: {
    color: LiftFlowColors.restTimer,
    letterSpacing: 2,
    fontWeight: '700',
    marginTop: Spacing.sm,
  },
  header: {
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  list: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  cardOuter: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  cardBorder: {
    borderRadius: Radius.lg,
    padding: 1,
  },
  card: {
    gap: Spacing.xs,
    backgroundColor: LiftFlowColors.surface,
    borderRadius: Radius.lg - 1,
    padding: Spacing.lg,
  },
  links: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  link: {
    minHeight: TouchTarget.min,
    justifyContent: 'center',
  },
});
