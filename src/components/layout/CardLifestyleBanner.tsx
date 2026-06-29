import { Image, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { BundledLifestyle } from '@/constants/lifestyleAssets';
import type { AppTheme } from '@/constants/themes';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useThemedStyles } from '@/hooks/useLiftFlowTheme';

type CardLifestyleBannerProps = {
  /** Bundled + remote sources, tried in order. */
  sources?: readonly ImageSource[];
  /** @deprecated Prefer `sources`. */
  uri?: string;
  /** @deprecated Prefer `sources`. */
  fallbackUris?: readonly string[];
  height?: number;
  style?: StyleProp<ViewStyle>;
  bleed?: boolean;
  vibrant?: boolean;
  accentLine?: boolean;
};

function resolveSources(
  sources: readonly ImageSource[] | undefined,
  uri: string | undefined,
  fallbackUris: readonly string[] | undefined,
): ImageSource[] {
  if (sources?.length) return [...sources];
  const list: ImageSource[] = [BundledLifestyle.workoutTraining];
  if (uri) list.unshift({ uri });
  fallbackUris?.forEach((item) => {
    if (item && item !== uri) list.push({ uri: item });
  });
  return list;
}

/** Lifestyle photo strip — bundled assets first so it never collapses to grey. */
export function CardLifestyleBanner({
  sources,
  uri,
  fallbackUris = [],
  height = 88,
  style,
  bleed = true,
  vibrant = true,
  accentLine = false,
}: CardLifestyleBannerProps) {
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const candidates = useMemo(
    () => resolveSources(sources, uri, fallbackUris),
    [sources, uri, fallbackUris],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const activeSource = candidates[Math.min(activeIndex, candidates.length - 1)];

  const overlayColors = vibrant
    ? theme.isDark
      ? (['transparent', 'rgba(8, 11, 16, 0.12)'] as const)
      : (['transparent', 'rgba(255, 255, 255, 0.08)'] as const)
    : theme.isDark
      ? (['transparent', 'rgba(8, 11, 16, 0.28)'] as const)
      : (['transparent', 'rgba(247, 250, 255, 0.32)'] as const);

  return (
    <View
      style={[
        styles.wrap,
        { height },
        bleed && {
          marginHorizontal: -theme.spacing.lg,
          marginTop: -theme.spacing.lg,
          width: undefined,
          alignSelf: 'stretch',
          borderTopLeftRadius: theme.radius.lg,
          borderTopRightRadius: theme.radius.lg,
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
        },
        style,
      ]}>
      {accentLine ? (
        <LinearGradient
          colors={[...theme.brandGradients.border.bold]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.accentLine}
        />
      ) : null}
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
      <LinearGradient colors={overlayColors} style={StyleSheet.absoluteFill} />
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    wrap: {
      width: '100%',
      borderRadius: theme.radius.md,
      overflow: 'hidden',
      marginBottom: theme.spacing.sm,
      backgroundColor: theme.colors.surfaceSoft,
    },
    accentLine: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      zIndex: 2,
    },
  });
}
