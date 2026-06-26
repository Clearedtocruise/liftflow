import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { TouchTarget, Typography } from '@/constants/theme';
import type { AppTheme } from '@/constants/themes';
import { useLiftFlowTheme, useThemedStyles } from '@/hooks/useLiftFlowTheme';

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
};

export function TextField({ label, error, style, ...rest }: TextFieldProps) {
  const styles = useThemedStyles(createStyles);
  const colors = useLiftFlowTheme();

  return (
    <View style={styles.wrapper}>
      <AppText variant="subhead" color="textSecondary" style={styles.label}>
        {label}
      </AppText>
      <TextInput
        style={[styles.input, error && styles.inputError, style]}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        {...rest}
      />
      {error ? (
        <AppText variant="caption" color="error">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    wrapper: {
      gap: theme.spacing.sm,
    },
    label: {
      marginLeft: theme.spacing.xs,
    },
    input: {
      minHeight: TouchTarget.comfortable,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.lg,
      color: theme.colors.textPrimary,
      ...Typography.body,
    },
    inputError: {
      borderColor: theme.colors.error,
    },
  });
}
