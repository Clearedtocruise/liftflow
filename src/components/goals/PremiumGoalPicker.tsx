import { Pressable, StyleSheet, View } from 'react-native';

import { PremiumGoalCard } from '@/components/goals/PremiumGoalCard';
import { AppText } from '@/components/ui/AppText';
import {
    PREMIUM_GOAL_OPTIONS,
    premiumGoalsToRankedBackendIds,
    type PremiumGoalId,
} from '@/constants/premiumGoals';
import { LiftFlowColors, Radius, Spacing, TouchTarget } from '@/constants/theme';
import type { TrainingGoalId } from '@/constants/trainingGoals';

type PremiumGoalPickerProps = {
  rankedPremiumGoals: PremiumGoalId[];
  onChange: (next: PremiumGoalId[]) => void;
  disabled?: boolean;
  maxGoals?: number;
};

export function PremiumGoalPicker({
  rankedPremiumGoals,
  onChange,
  disabled,
  maxGoals = 4,
}: PremiumGoalPickerProps) {
  function toggle(id: PremiumGoalId) {
    if (disabled) return;
    if (rankedPremiumGoals.includes(id)) {
      onChange(rankedPremiumGoals.filter((g) => g !== id));
      return;
    }
    if (rankedPremiumGoals.length >= maxGoals) return;
    onChange([...rankedPremiumGoals, id]);
  }

  function move(index: number, direction: -1 | 1) {
    if (disabled) return;
    const next = [...rankedPremiumGoals];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <View style={styles.root}>
      <AppText variant="footnote" color="textSecondary">
        Tap to select. Your #1 goal drives nutrition; all goals shape programming.
      </AppText>
      <View style={styles.grid}>
        {PREMIUM_GOAL_OPTIONS.map((goal) => {
          const rankIndex = rankedPremiumGoals.indexOf(goal.id);
          return (
            <PremiumGoalCard
              key={goal.id}
              goal={goal}
              selected={rankIndex >= 0}
              rank={rankIndex >= 0 ? rankIndex + 1 : undefined}
              onPress={() => toggle(goal.id)}
              disabled={disabled}
            />
          );
        })}
      </View>

      {rankedPremiumGoals.length > 0 ? (
        <View style={styles.priority}>
          <AppText variant="subhead" color="textSecondary">
            Your priorities
          </AppText>
          {rankedPremiumGoals.map((id, index) => {
            const goal = PREMIUM_GOAL_OPTIONS.find((g) => g.id === id)!;
            return (
              <View key={id} style={styles.priorityRow}>
                <AppText variant="bodyBold">
                  {index + 1}. {goal.icon} {goal.label}
                </AppText>
                <View style={styles.reorder}>
                  <Pressable
                    disabled={disabled || index === 0}
                    onPress={() => move(index, -1)}
                    style={styles.reorderBtn}>
                    <AppText variant="caption" color="accent">
                      ↑
                    </AppText>
                  </Pressable>
                  <Pressable
                    disabled={disabled || index === rankedPremiumGoals.length - 1}
                    onPress={() => move(index, 1)}
                    style={styles.reorderBtn}>
                    <AppText variant="caption" color="accent">
                      ↓
                    </AppText>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export function premiumRankedToTrainingGoals(ranked: PremiumGoalId[]): TrainingGoalId[] {
  return premiumGoalsToRankedBackendIds(ranked);
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    justifyContent: 'space-between',
  },
  priority: {
    gap: Spacing.sm,
    backgroundColor: LiftFlowColors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: TouchTarget.min,
  },
  reorder: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  reorderBtn: {
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
