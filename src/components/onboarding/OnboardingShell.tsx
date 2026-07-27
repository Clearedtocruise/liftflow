import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoMark } from '@/components/brand/LogoMark';
import { InsightCard } from '@/components/insights/InsightCard';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import type { LiftFlowInsight } from '@/constants/insights/types';
import { LiftFlowColors, Radius, Spacing, TouchTarget } from '@/constants/theme';

type OnboardingShellProps = {
  step: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  helperText?: string;
  heroImage?: string;
  insight?: LiftFlowInsight | null;
  children: ReactNode;
  onContinue: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  loading?: boolean;
  onBack?: () => void;
  hideProgress?: boolean;
};

export function OnboardingShell({
  step,
  totalSteps,
  title,
  subtitle,
  helperText,
  heroImage,
  insight,
  children,
  onContinue,
  continueLabel = 'Continue',
  continueDisabled,
  loading,
  onBack,
  hideProgress = false,
}: OnboardingShellProps) {
  const insets = useSafeAreaInsets();
  const [trackWidth, setTrackWidth] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(step / totalSteps, { damping: 18, stiffness: 120 });
  }, [step, totalSteps, progress]);

  const barStyle = useAnimatedStyle(() => ({
    width: trackWidth * progress.value,
  }));

  function onTrackLayout(e: LayoutChangeEvent) {
    setTrackWidth(e.nativeEvent.layout.width);
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['rgba(31, 107, 255, 0.1)', 'transparent']}
        style={styles.topGlow}
      />
      <View style={[styles.inner, { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.lg }]}>
        {!hideProgress ? (
          <View style={styles.progressHeader}>
            <View style={styles.logoRow}>
              <LogoMark size={28} glow={false} />
              <AppText variant="caption" color="textTertiary" style={styles.stepLabel}>
                STEP {step} OF {totalSteps}
              </AppText>
            </View>
            <View style={styles.track} onLayout={onTrackLayout}>
              <Animated.View style={[styles.fillWrap, barStyle]}>
                <LinearGradient
                  colors={[LiftFlowColors.primary, LiftFlowColors.gradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.fill}
                />
              </Animated.View>
            </View>
            {helperText ? (
              <AppText variant="callout" color="textPrimary" style={styles.helper}>
                {helperText}
              </AppText>
            ) : null}
          </View>
        ) : (
          <View style={styles.logoOnly}>
            <LogoMark size={28} glow={false} />
          </View>
        )}

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {heroImage ? (
            <View style={styles.heroWrap}>
              <Image source={{ uri: heroImage }} style={styles.hero} contentFit="cover" />
              <LinearGradient colors={['transparent', 'rgba(8,11,16,0.95)']} style={styles.heroFade} />
            </View>
          ) : null}

          <Animated.View key={`copy-${step}`} entering={FadeInDown.duration(320)} style={styles.copy}>
            <AppText variant="title">{title}</AppText>
            {subtitle ? (
              <AppText variant="body" color="textSecondary">
                {subtitle}
              </AppText>
            ) : null}
          </Animated.View>

          {children}

          {insight ? <InsightCard insight={insight} compact /> : null}
        </ScrollView>

        <View style={styles.actions}>
          {onBack ? (
            <View style={styles.actionRow}>
              <Pressable
                onPress={onBack}
                disabled={loading}
                style={styles.backHit}
                accessibilityRole="button"
                accessibilityLabel="Go back">
                <AppText variant="bodyBold" color="textSecondary">
                  Back
                </AppText>
              </Pressable>
              <View style={styles.primaryWrap}>
                <PrimaryButton
                  label={continueLabel}
                  onPress={onContinue}
                  disabled={continueDisabled}
                  loading={loading}
                  size="large"
                />
              </View>
            </View>
          ) : (
            <PrimaryButton
              label={continueLabel}
              onPress={onContinue}
              disabled={continueDisabled}
              loading={loading}
              size="large"
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LiftFlowColors.background,
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  inner: {
    flex: 1,
    paddingHorizontal: Spacing.xxl,
  },
  progressHeader: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  logoOnly: {
    marginBottom: Spacing.lg,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  stepLabel: {
    letterSpacing: 1.2,
  },
  track: {
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: LiftFlowColors.surfaceElevated,
    overflow: 'hidden',
  },
  fillWrap: {
    height: '100%',
    overflow: 'hidden',
    borderRadius: Radius.full,
  },
  fill: {
    flex: 1,
    borderRadius: Radius.full,
  },
  helper: {
    marginTop: Spacing.xs,
  },
  scroll: {
    gap: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },
  heroWrap: {
    height: 140,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  hero: {
    width: '100%',
    height: '100%',
  },
  heroFade: {
    ...StyleSheet.absoluteFillObject,
  },
  copy: {
    gap: Spacing.sm,
  },
  actions: {
    paddingTop: Spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  backHit: {
    minHeight: TouchTarget.min,
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  primaryWrap: {
    flex: 1,
  },
});
