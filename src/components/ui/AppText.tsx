import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import type { ThemeColorPalette } from '@/constants/themes';
import { Typography } from '@/constants/theme';
import { useLiftFlowTheme } from '@/hooks/useLiftFlowTheme';

type TypographyVariant = keyof typeof Typography;

type AppTextProps = TextProps & {
  variant?: TypographyVariant;
  color?: keyof ThemeColorPalette | string;
  align?: TextStyle['textAlign'];
};

export function AppText({
  variant = 'body',
  color = 'textPrimary',
  align,
  style,
  ...rest
}: AppTextProps) {
  const colors = useLiftFlowTheme();
  const textColor = color in colors ? colors[color as keyof ThemeColorPalette] : color;

  return (
    <Text
      style={[Typography[variant], { color: textColor, textAlign: align }, style]}
      {...rest}
    />
  );
}

export function ThemedLinkText({ style, ...rest }: TextProps) {
  const colors = useLiftFlowTheme();
  return <Text style={[styles.link, { color: colors.primary }, style]} {...rest} />;
}

const styles = StyleSheet.create({
  link: {
    fontWeight: '600',
  },
});

/** @deprecated Use ThemedLinkText */
export const textStyles = StyleSheet.create({
  link: {
    fontWeight: '600',
  },
});
