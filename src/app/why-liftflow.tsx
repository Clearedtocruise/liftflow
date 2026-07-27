import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Dimensions, LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoMark } from '@/components/brand/LogoMark';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { Brand, LiftFlowColors, Spacing, TouchTarget } from '@/constants/theme';
import { WHY_LIFTFLOW_SLIDES } from '@/constants/whyLiftFlow';

const { width, height } = Dimensions.get('window');
const HERO_HEIGHT = Math.min(height * 0.42, 360);

export default function WhyLiftFlowScreen() {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [trackWidth, setTrackWidth] = useState(0);
  const slide = WHY_LIFTFLOW_SLIDES[index];
  const isLast = index === WHY_LIFTFLOW_SLIDES.length - 1;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring((index + 1) / WHY_LIFTFLOW_SLIDES.length, {
      damping: 18,
      stiffness: 140,
    });
  }, [index, progress]);

  const progressStyle = useAnimatedStyle(() => ({
    width: trackWidth * progress.value,
  }));

  function onTrackLayout(e: LayoutChangeEvent) {
    setTrackWidth(e.nativeEvent.layout.width);
  }

  function goToLegal() {
    router.replace('/(onboarding)/legal');
  }

  function advance() {
    if (isLast) {
      goToLegal();
      return;
    }
    setIndex((i) => i + 1);
  }

  const bodyLines = Array.isArray(slide.body) ? slide.body : [slide.body];

  return (
    <View style={styles.root}>
      <View style={[styles.heroPlane, { height: HERO_HEIGHT + insets.top }]}>
        <Animated.View key={`img-${slide.id}`} entering={FadeIn.duration(420)} style={StyleSheet.absoluteFill}>
          <Image source={{ uri: slide.image }} style={styles.heroImage} contentFit="cover" />
        </Animated.View>
        <LinearGradient
          colors={['rgba(8,11,16,0.35)', 'rgba(8,11,16,0.55)', LiftFlowColors.background]}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.heroChrome, { paddingTop: insets.top + Spacing.md }]}>
          <LogoMark size={36} glow={false} />
          <View style={styles.progressTrack} onLayout={onTrackLayout}>
            <Animated.View style={[styles.progressFill, progressStyle]} />
          </View>
          <AppText variant="caption" color="textSecondary">
            {index + 1}/{WHY_LIFTFLOW_SLIDES.length}
          </AppText>
        </View>
      </View>

      <View style={[styles.bodyPane, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <Animated.View
          key={slide.id}
          entering={FadeInDown.duration(380)}
          style={styles.copy}>
          <AppText variant="title" style={styles.title}>
            {slide.title}
          </AppText>
          {index === 0 ? (
            <AppText variant="callout" color="accent" style={styles.tagline}>
              {Brand.taglinePrimary}
            </AppText>
          ) : null}
          <View style={styles.bodyLines}>
            {bodyLines.map((line, i) => (
              <AppText
                key={`${slide.id}-${i}`}
                variant={Array.isArray(slide.body) ? 'body' : 'body'}
                color="textSecondary"
                style={styles.line}>
                {Array.isArray(slide.body) ? `·  ${line}` : line}
              </AppText>
            ))}
          </View>
        </Animated.View>

        <View style={styles.footer}>
          <PrimaryButton label={slide.cta ?? 'Continue'} size="large" onPress={advance} />
          {!isLast ? (
            <Pressable
              onPress={goToLegal}
              style={styles.skip}
              accessibilityRole="button"
              accessibilityLabel="Skip introduction and continue to legal">
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
  heroPlane: {
    width,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroChrome: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xxl,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: LiftFlowColors.primary,
    borderRadius: 2,
  },
  bodyPane: {
    flex: 1,
    paddingHorizontal: Spacing.xxl,
    justifyContent: 'space-between',
    marginTop: -Spacing.xl,
  },
  copy: {
    gap: Spacing.md,
    paddingTop: Spacing.md,
  },
  title: {
    letterSpacing: 0.8,
  },
  tagline: {
    letterSpacing: 1.5,
  },
  bodyLines: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  line: {
    maxWidth: width - Spacing.xxl * 2,
  },
  footer: {
    gap: Spacing.md,
    paddingTop: Spacing.lg,
  },
  skip: {
    minHeight: TouchTarget.min,
    justifyContent: 'center',
  },
});
