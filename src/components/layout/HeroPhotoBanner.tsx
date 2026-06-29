import { Image, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { LiftFlowWordmark } from '@/components/brand/LiftFlowWordmark';
import { LogoMark } from '@/components/brand/LogoMark';
import { AppText } from '@/components/ui/AppText';
import { BundledLifestyle } from '@/constants/lifestyleAssets';
import type { AppTheme } from '@/constants/themes';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useThemedStyles } from '@/hooks/useLiftFlowTheme';

type HeroPhotoBannerProps = {
  sources?: readonly ImageSource[];
  /** @deprecated Prefer `sources`. */
  uri?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
  showBrand?: boolean;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  children?: ReactNode;
};

function resolveSources(sources: readonly ImageSource[] | undefined, uri: string | undefined): ImageSource[] {
  if (sources?.length) return [...sources];
  if (uri) return [{ uri }, BundledLifestyle.heroWorkout];
  return [BundledLifestyle.heroWorkout, BundledLifestyle.workoutTraining];
}

/** Lifestyle photography strip with greeting — bundled photos always load. */
export function HeroPhotoBanner({
  sources,
  uri,
  height = 168,
  style,
  showBrand = true,
  eyebrow,
  title,
  subtitle,
  children,
}: HeroPhotoBannerProps) {
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const candidates = useMemo(() => resolveSources(sources, uri), [sources, uri]);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeSource = candidates[Math.min(activeIndex, candidates.length - 1)];

  return (
    <View style={[styles.wrap, { height }, style]}>
      <Image
        key={typeof activeSource === 'number' ? `asset-${activeSource}` : JSON.stringify(activeSource)}
        source={activeSource}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={240}
        cachePolicy="memory-disk"
        onError={() => {
          setActiveIndex((index) => (index < candidates.length - 1 ? index + 1 : index));
        }}
      />
      <LinearGradient colors={['rgba(15, 23, 42, 0.35)', 'transparent', 'transparent']} style={styles.topFade} />
      <LinearGradient colors={[...theme.brandGradients.photoOverlay]} style={StyleSheet.absoluteFill} />
      {showBrand ? (
        <View style={styles.brandRow}>
          <View style={styles.brandPill}>
            <LogoMark size={40} variant="white" glow={false} animate={false} compact />
            <LiftFlowWordmark size="sm" align="left" tone="onPhoto" />
          </View>
        </View>
      ) : null}
      <View style={styles.content}>
        {!showBrand && eyebrow ? (
          <AppText variant="label" style={styles.onPhoto}>
            {eyebrow}
          </AppText>
        ) : null}
        {title ? (
          <AppText variant="headline" style={styles.onPhotoTitle}>
            {title}
          </AppText>
        ) : null}
        {subtitle ? (
          <AppText variant="footnote" style={styles.onPhotoSub} numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
        {children}
      </View>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    wrap: {
      borderRadius: theme.radius.xl,
      overflow: 'hidden',
      width: '100%',
      backgroundColor: theme.colors.surfaceSoft,
    },
    topFade: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 88,
    },
    brandRow: {
      position: 'absolute',
      top: theme.spacing.md,
      left: theme.spacing.md,
      right: theme.spacing.md,
      zIndex: 2,
    },
    brandPill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: theme.spacing.sm,
      backgroundColor: 'rgba(15, 23, 42, 0.72)',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radius.lg,
      maxWidth: '100%',
    },
    content: {
      flex: 1,
      justifyContent: 'flex-end',
      padding: theme.spacing.lg,
      gap: theme.spacing.xs,
      zIndex: 1,
    },
    onPhoto: {
      color: 'rgba(255,255,255,0.9)',
    },
    onPhotoTitle: {
      color: '#FFFFFF',
    },
    onPhotoSub: {
      color: 'rgba(255,255,255,0.85)',
    },
  });
}
