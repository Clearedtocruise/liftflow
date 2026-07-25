import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing, TouchTarget, Typography } from '@/constants/theme';

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
};

export function TextField({ label, error, style, ...rest }: TextFieldProps) {
  return (
    <View style={styles.wrapper}>
      <AppText variant="subhead" color="textSecondary" style={styles.label}>
        {label}
      </AppText>
      <TextInput
        style={[styles.input, error && styles.inputError, style]}
        placeholderTextColor={LiftFlowColors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        // The visible label is a sibling Text, which screen readers do not associate with the
        // input, and the error below it is announced nowhere unless attached to the field itself.
        accessibilityLabel={label}
        accessibilityHint={error}
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

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.sm,
  },
  label: {
    marginLeft: Spacing.xs,
  },
  input: {
    minHeight: TouchTarget.comfortable,
    backgroundColor: LiftFlowColors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    paddingHorizontal: Spacing.lg,
    color: LiftFlowColors.textPrimary,
    ...Typography.body,
  },
  inputError: {
    borderColor: LiftFlowColors.error,
  },
});
