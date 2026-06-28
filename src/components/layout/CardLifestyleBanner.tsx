import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { AppTheme } from '@/constants/themes';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useThemedStyles } from '@/hooks/useLiftFlowTheme';

type CardLifestyleBannerProps = {
  uri: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
  /** Pull photo to card edges (matches Card padding). */
  bleed?: boolean;
};

/** Compact lifestyle photo strip — adds human energy inside cards. */
export function CardLifestyleBanner({ uri, height = 88, style, bleed = true }: CardLifestyleBannerProps) {
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles);

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
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      <LinearGradient
        colors={
          theme.isDark
            ? ['transparent', 'rgba(8, 11, 16, 0.55)']
            : ['transparent', 'rgba(247, 250, 255, 0.65)']
        }
        style={StyleSheet.absoluteFill}
      />
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
    },
  });
}
