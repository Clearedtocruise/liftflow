import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, LayoutChangeEvent, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LiftFlowLogo } from '@/components/brand/LiftFlowLogo';
import { InsightCard } from '@/components/insights/InsightCard';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import type { LiftFlowInsight } from '@/constants/insights/types';
import { Brand, LiftFlowColors, Radius, Spacing } from '@/constants/theme';

type OnboardingShellProps = {
  step: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  helperText?: string;
  heroImage?: string;
  /** Full-bleed hero behind the first viewport — use on the opening beat. */
  fullBleedHero?: string;
  insight?: LiftFlowInsight | null;
  children: ReactNode;
  onContinue: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  loading?: boolean;
  onBack?: () => void;
  /** Hide the step counter (building / reveal). */
  hideProgress?: boolean;
};

export function OnboardingShell({
  step,
  totalSteps,
  title,
  subtitle,
  helperText,
  heroImage,
  fullBleedHero,
  insight,
  children,
  onContinue,
  continueLabel = 'Continue',
  continueDisabled,
  loading,
  onBack,
  hideProgress,
}: OnboardingShellProps) {
  const insets = useSafeAreaInsets();
  const pct = Math.round((step / totalSteps) * 100);
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
      {fullBleedHero ? (
        <View style={styles.bleedWrap} pointerEvents="none">
          <Image source={{ uri: fullBleedHero }} style={styles.bleedImage} contentFit="cover" />
          <LinearGradient
            colors={['rgba(8,11,16,0.35)', 'rgba(8,11,16,0.88)', LiftFlowColors.background]}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : (
        <LinearGradient
          colors={['rgba(14, 144, 255, 0.1)', 'transparent']}
          style={styles.topGlow}
        />
      )}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View
          style={[
            styles.inner,
            { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.lg },
          ]}>
          <View style={styles.progressHeader}>
            <View style={styles.logoRow}>
              <LiftFlowLogo size={28} variant="primary" />
              <View>
                <AppText variant="label" style={styles.brandPrimary}>
                  {Brand.name}
                </AppText>
                <AppText variant="caption" color="textTertiary" style={styles.brandSecondary}>
                  FITNESS
                </AppText>
              </View>
            </View>
            {!hideProgress ? (
              <>
                <View style={styles.progressRow}>
                  <AppText variant="caption" color="textSecondary">
                    {step} of {totalSteps}
                  </AppText>
                  <AppText variant="caption" color="accent">
                    {pct}%
                  </AppText>
                </View>
                <View style={styles.track} onLayout={onTrackLayout}>
                  <Animated.View style={[styles.fillWrap, barStyle]}>
                    <LinearGradient
                      colors={[LiftFlowColors.primary, LiftFlowColors.restTimer]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.fill}
                    />
                  </Animated.View>
                </View>
              </>
            ) : null}
            {helperText ? (
              <AppText variant="callout" color="textPrimary" style={styles.helper}>
                {helperText}
              </AppText>
            ) : null}
          </View>

          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {heroImage && !fullBleedHero ? (
              <View style={styles.heroWrap}>
                <Image source={{ uri: heroImage }} style={styles.hero} contentFit="cover" />
                <LinearGradient
                  colors={['transparent', 'rgba(8,11,16,0.95)']}
                  style={styles.heroFade}
                />
              </View>
            ) : null}

            {(title || subtitle) ? (
              <Animated.View entering={FadeInDown.duration(320)} style={styles.copy}>
                {title ? <AppText variant="title">{title}</AppText> : null}
                {subtitle ? (
                  <AppText variant="body" color="textSecondary">
                    {subtitle}
                  </AppText>
                ) : null}
              </Animated.View>
            ) : null}

            {children}

            {insight ? <InsightCard insight={insight} compact /> : null}
          </ScrollView>

          <View style={styles.actions}>
            {onBack ? (
              <PrimaryButton label="Back" variant="secondary" onPress={onBack} disabled={loading} />
            ) : null}
            <PrimaryButton
              label={continueLabel}
              onPress={onContinue}
              disabled={continueDisabled}
              loading={loading}
              size="large"
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LiftFlowColors.background,
  },
  flex: {
    flex: 1,
  },
  bleedWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  bleedImage: {
    width: '100%',
    height: '55%',
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
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.xs,
  },
  brandPrimary: {
    color: LiftFlowColors.restTimer,
    letterSpacing: 1.2,
    fontWeight: '700',
    fontSize: 13,
    lineHeight: 16,
  },
  brandSecondary: {
    letterSpacing: 2,
    fontSize: 8,
    lineHeight: 10,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  track: {
    height: 6,
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
    height: 160,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
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
    gap: Spacing.md,
    paddingTop: Spacing.md,
  },
});
