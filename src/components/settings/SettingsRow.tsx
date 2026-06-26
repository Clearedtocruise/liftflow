import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppSymbol, SYMBOL_FALLBACKS } from '@/components/ui/AppSymbol';
import { AppText } from '@/components/ui/AppText';
import { TouchTarget } from '@/constants/theme';
import type { AppTheme } from '@/constants/themes';
import { useLiftFlowTheme, useThemedStyles } from '@/hooks/useLiftFlowTheme';
import type { ConfirmationMode } from '@/types/common';

type SettingsRowProps = {
  label: string;
  value?: string;
  icon?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  testID?: string;
};

export function SettingsRow({ label, value, icon, onPress, destructive, testID }: SettingsRowProps) {
  const colors = useLiftFlowTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      testID={testID}
      style={({ pressed }) => [styles.row, pressed && onPress && styles.pressed]}
      accessibilityRole={onPress ? 'button' : undefined}>
      {icon}
      <AppText variant="body" color={destructive ? 'error' : 'textPrimary'} style={styles.label}>
        {label}
      </AppText>
      {value ? (
        <AppText variant="footnote" color="textSecondary">
          {value}
        </AppText>
      ) : onPress ? (
        <AppSymbol
          name="chevron.right"
          fallback={SYMBOL_FALLBACKS['chevron.right']}
          size={14}
          tintColor={colors.textTertiary}
        />
      ) : null}
    </Pressable>
  );
}

type ConfirmationModePickerProps = {
  value: ConfirmationMode;
  onChange?: (mode: ConfirmationMode) => void;
};

const MODES: { id: ConfirmationMode; label: string; description: string }[] = [
  { id: 'always', label: 'Always Confirm', description: 'Confirm every voice log' },
  { id: 'smart', label: 'Smart Confirm', description: 'Confirm when uncertain' },
  { id: 'none', label: 'No Confirm', description: 'Log instantly' },
];

export function ConfirmationModePicker({ value, onChange }: ConfirmationModePickerProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <Card style={styles.pickerCard}>
      <AppText variant="bodyBold" style={styles.pickerTitle}>
        Voice Confirmation
      </AppText>
      {MODES.map((mode) => {
        const selected = value === mode.id;
        return (
          <Pressable
            key={mode.id}
            onPress={() => onChange?.(mode.id)}
            style={[styles.modeRow, selected && styles.modeRowSelected]}>
            <View style={styles.modeText}>
              <AppText variant="callout">{mode.label}</AppText>
              <AppText variant="caption" color="textSecondary">
                {mode.description}
              </AppText>
            </View>
            <View style={[styles.radio, selected && styles.radioSelected]}>
              {selected ? <View style={styles.radioDot} /> : null}
            </View>
          </Pressable>
        );
      })}
    </Card>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: TouchTarget.comfortable,
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    label: {
      flex: 1,
    },
    pressed: {
      opacity: 0.7,
    },
    pickerCard: {
      gap: theme.spacing.sm,
    },
    pickerTitle: {
      marginBottom: theme.spacing.sm,
    },
    modeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      gap: theme.spacing.md,
    },
    modeRowSelected: {
      backgroundColor: theme.colors.accentGlow,
    },
    modeText: {
      flex: 1,
      gap: theme.spacing.xs,
    },
    radio: {
      width: 22,
      height: 22,
      borderRadius: theme.radius.full,
      borderWidth: 2,
      borderColor: theme.colors.textTertiary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioSelected: {
      borderColor: theme.colors.accent,
    },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.accent,
    },
  });
}
