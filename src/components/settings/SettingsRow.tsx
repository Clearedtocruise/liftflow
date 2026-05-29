import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppSymbol, SYMBOL_FALLBACKS } from '@/components/ui/AppSymbol';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing, TouchTarget } from '@/constants/theme';
import type { ConfirmationMode } from '@/types/common';

type SettingsRowProps = {
  label: string;
  value?: string;
  icon?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
};

export function SettingsRow({ label, value, icon, onPress, destructive }: SettingsRowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
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
          tintColor={LiftFlowColors.textTertiary}
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

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TouchTarget.comfortable,
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  label: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  pickerCard: {
    gap: Spacing.sm,
  },
  pickerTitle: {
    marginBottom: Spacing.sm,
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 12,
    gap: Spacing.md,
  },
  modeRowSelected: {
    backgroundColor: LiftFlowColors.accentGlow,
  },
  modeText: {
    flex: 1,
    gap: Spacing.xs,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: LiftFlowColors.textTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: LiftFlowColors.accent,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: LiftFlowColors.accent,
  },
});
