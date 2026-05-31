import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ChipGrid, SelectableChip } from '@/components/onboarding/SelectableChip';
import { AppSymbol, SYMBOL_FALLBACKS } from '@/components/ui/AppSymbol';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing, TouchTarget } from '@/constants/theme';
import {
    getTrainingGoalLabel,
    GOAL_COMBINATION_PRESETS,
    TRAINING_GOAL_OPTIONS,
    type TrainingGoalId,
} from '@/constants/trainingGoals';

type GoalPickerProps = {
  /** Ordered by priority — index 0 is highest. */
  rankedGoals: TrainingGoalId[];
  onChange: (next: TrainingGoalId[]) => void;
  disabled?: boolean;
  maxGoals?: number;
};

export function GoalPicker({ rankedGoals, onChange, disabled, maxGoals = 4 }: GoalPickerProps) {
  function toggle(id: TrainingGoalId) {
    if (disabled) return;
    if (rankedGoals.includes(id)) {
      onChange(rankedGoals.filter((g) => g !== id));
      return;
    }
    if (rankedGoals.length >= maxGoals) return;
    onChange([...rankedGoals, id]);
  }

  function move(index: number, direction: -1 | 1) {
    if (disabled) return;
    const next = [...rankedGoals];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function applyPreset(goals: TrainingGoalId[]) {
    if (disabled) return;
    onChange([...goals]);
  }

  return (
    <View style={styles.root}>
      <AppText variant="caption" color="textSecondary">
        Common combinations
      </AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
        {GOAL_COMBINATION_PRESETS.map((preset) => (
          <Pressable
            key={preset.id}
            disabled={disabled}
            onPress={() => applyPreset(preset.goals)}
            style={({ pressed }) => [styles.presetBtn, pressed && styles.presetPressed]}>
            <AppText variant="footnote" style={styles.presetLabel}>
              {preset.label}
            </AppText>
          </Pressable>
        ))}
      </ScrollView>

      <AppText variant="caption" color="textSecondary">
        Select up to {maxGoals} goals
      </AppText>
      <ChipGrid>
        {TRAINING_GOAL_OPTIONS.map((opt) => (
          <SelectableChip
            key={opt.id}
            label={opt.label}
            selected={rankedGoals.includes(opt.id)}
            onPress={() => toggle(opt.id)}
          />
        ))}
      </ChipGrid>

      {rankedGoals.length > 0 ? (
        <View style={styles.prioritySection}>
          <AppText variant="subhead" color="textSecondary">
            Priority order (top = main goal)
          </AppText>
          {rankedGoals.map((id, index) => (
            <View key={id} style={styles.priorityRow}>
              <View style={styles.priorityBadge}>
                <AppText variant="footnote" color="background">
                  {index + 1}
                </AppText>
              </View>
              <View style={styles.priorityText}>
                <AppText variant="bodyBold">{getTrainingGoalLabel(id)}</AppText>
                <AppText variant="footnote" color="textTertiary">
                  {TRAINING_GOAL_OPTIONS.find((o) => o.id === id)?.description}
                </AppText>
              </View>
              <View style={styles.priorityActions}>
                <Pressable
                  disabled={disabled || index === 0}
                  onPress={() => move(index, -1)}
                  style={[styles.iconBtn, index === 0 && styles.iconBtnDisabled]}
                  accessibilityLabel="Move up">
                  <AppSymbol name="chevron.up" fallback={SYMBOL_FALLBACKS['chevron.up'] ?? '↑'} size={16} tintColor={LiftFlowColors.textSecondary} />
                </Pressable>
                <Pressable
                  disabled={disabled || index === rankedGoals.length - 1}
                  onPress={() => move(index, 1)}
                  style={[styles.iconBtn, index === rankedGoals.length - 1 && styles.iconBtnDisabled]}
                  accessibilityLabel="Move down">
                  <AppSymbol name="chevron.down" fallback={SYMBOL_FALLBACKS['chevron.down'] ?? '↓'} size={16} tintColor={LiftFlowColors.textSecondary} />
                </Pressable>
              </View>
            </View>
          ))}
          <AppText variant="footnote" color="textTertiary">
            #{1} drives nutrition targets. Other goals adjust your workouts.
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.md,
  },
  presetRow: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  presetBtn: {
    minHeight: TouchTarget.min,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.accent,
    backgroundColor: LiftFlowColors.surfaceElevated,
  },
  presetPressed: {
    opacity: 0.85,
  },
  presetLabel: {
    fontWeight: '600',
    color: LiftFlowColors.textPrimary,
  },
  prioritySection: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LiftFlowColors.border,
  },
  priorityBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: LiftFlowColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityText: {
    flex: 1,
    gap: 2,
  },
  priorityActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  iconBtn: {
    width: TouchTarget.min,
    height: TouchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnDisabled: {
    opacity: 0.35,
  },
});
