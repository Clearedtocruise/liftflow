import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { LiftFlowColors, Typography } from '@/constants/theme';

type TypographyVariant = keyof typeof Typography;

type AppTextProps = TextProps & {
  variant?: TypographyVariant;
  color?: keyof typeof LiftFlowColors | string;
  align?: TextStyle['textAlign'];
};

export function AppText({
  variant = 'body',
  color = 'textPrimary',
  align,
  style,
  ...rest
}: AppTextProps) {
  const textColor =
    color in LiftFlowColors
      ? LiftFlowColors[color as keyof typeof LiftFlowColors]
      : color;

  return (
    <Text
      style={[Typography[variant], { color: textColor, textAlign: align }, style]}
      {...rest}
    />
  );
}

export const textStyles = StyleSheet.create({
  link: {
    color: LiftFlowColors.accent,
    fontWeight: '600',
  },
});
