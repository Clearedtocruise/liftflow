import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInRight, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoMark } from '@/components/brand/LogoMark';
import { InsightCard } from '@/components/insights/InsightCard';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { Brand, LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { WHY_LIFTFLOW_SLIDES } from '@/constants/whyLiftFlow';
import { useInsightRotator } from '@/hooks/useInsightRotator';

const { width } = Dimensions.get('window');

export default function WhyLiftFlowScreen() {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const { insight } = useInsightRotator('coaching');
  const slide = WHY_LIFTFLOW_SLIDES[index];
  const isLast = index === WHY_LIFTFLOW_SLIDES.length - 1;

  function advance() {
    if (isLast) {
      router.replace('/(onboarding)/legal');
      return;
    }
    setIndex((i) => i + 1);
  }

  const bodyLines = Array.isArray(slide.body) ? slide.body : [slide.body];

  return (
    <View style={styles.root}>
      <LinearGradient colors={['rgba(31, 107, 255, 0.1)', 'transparent']} style={styles.topGlow} />
      <View style={[styles.inner, { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.lg }]}>
        <View style={styles.topRow}>
          <LogoMark size={40} glow={false} />
          <View style={styles.dots}>
            {WHY_LIFTFLOW_SLIDES.map((s, i) => (
              <View key={s.id} style={[styles.dot, i === index && styles.dotActive, i < index && styles.dotDone]} />
            ))}
          </View>
        </View>

        <Animated.View key={slide.id} entering={FadeInRight.duration(320)} exiting={FadeOut.duration(180)} style={styles.slide}>
          <View style={styles.heroWrap}>
            <Image source={{ uri: slide.image }} style={styles.hero} contentFit="cover" />
            <LinearGradient colors={['transparent', 'rgba(8,11,16,0.98)']} style={styles.heroFade} />
          </View>

          <AppText variant="title" style={styles.title}>
            {slide.title}
          </AppText>
          {index === 0 ? (
            <AppText variant="callout" color="accent">
              {Brand.taglinePrimary}
            </AppText>
          ) : null}
          <View style={styles.body}>
            {bodyLines.map((line, i) =>
              line === '' ? (
                <View key={`sp-${i}`} style={styles.spacer} />
              ) : (
                <AppText
                  key={`${line}-${i}`}
                  variant={line.startsWith('✓') ? 'bodyBold' : 'body'}
                  color={line.startsWith('•') || line.startsWith('✓') ? 'textSecondary' : 'textPrimary'}>
                  {line}
                </AppText>
              ),
            )}
          </View>

          {insight && index % 2 === 1 ? (
            <Animated.View entering={FadeIn.delay(200)}>
              <InsightCard insight={insight} compact />
            </Animated.View>
          ) : null}
        </Animated.View>

        <View style={styles.footer}>
          <PrimaryButton label={slide.cta ?? 'Continue'} size="large" onPress={advance} />
          {!isLast ? (
            <Pressable onPress={() => router.replace('/(onboarding)/legal')}>
              <AppText variant="footnote" color="textTertiary" align="center">
                Skip intro
              </AppText>
            </Pressable>
          ) : null}
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
    height: 180,
  },
  inner: {
    flex: 1,
    paddingHorizontal: Spacing.xxl,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: LiftFlowColors.surfaceHighlight,
  },
  dotActive: {
    width: 24,
    backgroundColor: LiftFlowColors.primary,
  },
  dotDone: {
    backgroundColor: LiftFlowColors.accent,
  },
  slide: {
    flex: 1,
    gap: Spacing.lg,
  },
  heroWrap: {
    height: width * 0.44,
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
  title: {
    letterSpacing: 0.8,
  },
  body: {
    gap: Spacing.xs,
  },
  spacer: {
    height: Spacing.sm,
  },
  footer: {
    gap: Spacing.md,
    paddingTop: Spacing.md,
  },
});
