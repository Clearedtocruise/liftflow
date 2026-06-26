import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { LiftFlowWordmark } from '@/components/brand/LiftFlowWordmark';
import { LogoMark } from '@/components/brand/LogoMark';
import { AppText } from '@/components/ui/AppText';
import { BrandGradients, Radius, Spacing } from '@/constants/theme';

type HeroPhotoBannerProps = {
  uri: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
  /** ONE MORE logo lockup at top of the photo. */
  showBrand?: boolean;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  children?: ReactNode;
};

/** Lifestyle photography strip with brand lockup — athletes + ONE MORE identity. */
export function HeroPhotoBanner({
  uri,
  height = 168,
  style,
  showBrand = true,
  eyebrow,
  title,
  subtitle,
  children,
}: HeroPhotoBannerProps) {
  return (
    <View style={[styles.wrap, { height }, style]}>
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      <LinearGradient colors={['rgba(15, 23, 42, 0.5)', 'transparent', 'transparent']} style={styles.topFade} />
      <LinearGradient colors={[...BrandGradients.photoOverlay]} style={StyleSheet.absoluteFill} />
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

const styles = StyleSheet.create({
  wrap: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
    width: '100%',
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
    top: Spacing.md,
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 2,
  },
  brandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.lg,
    maxWidth: '100%',
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: Spacing.lg,
    gap: Spacing.xs,
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
