import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { AppTheme, BrandGradientSet } from '@/constants/themes';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useThemedStyles } from '@/hooks/useLiftFlowTheme';

type GradientIntensity = keyof BrandGradientSet['border'];

type GradientBorderCardProps = {
  children: ReactNode;
  style?: ViewStyle;
  innerStyle?: StyleProp<ViewStyle>;
  intensity?: GradientIntensity;
};

export function GradientBorderCard({
  children,
  style,
  innerStyle,
  intensity = 'default',
}: GradientBorderCardProps) {
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.outer, style]}>
      <LinearGradient
        colors={[...theme.brandGradients.border[intensity]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.border}>
        <View style={[styles.inner, innerStyle]}>{children}</View>
      </LinearGradient>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    outer: {
      borderRadius: theme.radius.lg,
      overflow: 'hidden',
    },
    border: {
      borderRadius: theme.radius.lg,
      padding: 1,
    },
    inner: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg - 1,
      padding: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
  });
}
