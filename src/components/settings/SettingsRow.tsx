import { Children, cloneElement, isValidElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppSymbol, SYMBOL_FALLBACKS } from '@/components/ui/AppSymbol';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing, TouchTarget } from '@/constants/theme';
import type { ConfirmationMode } from '@/types/common';

type SettingsRowProps = {
  label: string;
  /** A short trailing status, such as "On" or "Allowed". */
  value?: string;
  /**
   * A sentence explaining what the row does, shown under the label.
   *
   * Anything longer than a couple of words belongs here rather than in `value`: a trailing string
   * takes the width it asks for, so a sentence there squeezes the label down its own column, one
   * character per line.
   */
  description?: string;
  icon?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  /** Set by SettingsGroup: draws the hairline that divides this row from the one above. */
  separated?: boolean;
  /** Set by SettingsGroup: holds the icon column open so labels line up with its icon-bearing rows. */
  reserveIcon?: boolean;
};

export function SettingsRow({
  label,
  value,
  description,
  icon,
  onPress,
  destructive,
  separated,
  reserveIcon,
}: SettingsRowProps) {
  // A value reports state the row already changed in place; without one, the row leads somewhere.
  const showChevron = Boolean(onPress) && !value;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, separated && styles.separated, pressed && onPress && styles.pressed]}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={description ? `${label}. ${description}` : undefined}>
      {icon ? (
        <View style={styles.iconChip}>{icon}</View>
      ) : reserveIcon ? (
        <View style={styles.iconSpacer} />
      ) : null}

      <View style={styles.text}>
        <AppText variant="body" color={destructive ? 'error' : 'textPrimary'}>
          {label}
        </AppText>
        {description ? (
          <AppText variant="footnote" color="textSecondary" style={styles.description}>
            {description}
          </AppText>
        ) : null}
      </View>

      {value ? (
        <AppText variant="footnote" color="textSecondary" numberOfLines={2} style={styles.value}>
          {value}
        </AppText>
      ) : null}

      {showChevron ? (
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

type SettingsGroupProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * One card of settings rows, divided by hairlines.
 *
 * Rows that carry a description are two lines tall, and without a divider between them a group
 * reads as one run-on block of text instead of a list of separate controls.
 */
export function SettingsGroup({ children, style }: SettingsGroupProps) {
  const items = Children.toArray(children);
  const isRow = (child: ReactNode): child is React.ReactElement<SettingsRowProps> =>
    isValidElement(child) && child.type === SettingsRow;
  // One row with an icon indents every label in the group, so the rest keep the column open rather
  // than starting at the card edge and leaving the list ragged.
  const reserveIcon = items.some((child) => isRow(child) && Boolean(child.props.icon));

  return (
    <Card style={[styles.group, style]}>
      {items.map((child, index) =>
        isRow(child) ? cloneElement(child, { reserveIcon, separated: index > 0 }) : child,
      )}
    </Card>
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

const ICON_COLUMN = 32;

const styles = StyleSheet.create({
  group: {
    // The rows carry their own vertical padding, and the dividers need to reach the card's edges.
    paddingVertical: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TouchTarget.comfortable,
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  separated: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LiftFlowColors.border,
  },
  iconChip: {
    width: ICON_COLUMN,
    height: ICON_COLUMN,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LiftFlowColors.surfaceElevated,
  },
  iconSpacer: {
    width: ICON_COLUMN,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  description: {
    lineHeight: 18,
  },
  value: {
    // Without this the trailing text keeps its full width and crushes the label beside it.
    flexShrink: 1,
    maxWidth: '40%',
    textAlign: 'right',
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
