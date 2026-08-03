import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing, TouchTarget } from '@/constants/theme';
import type { MealDefault } from '@/lib/mealDefaults';
import { enrichMealMeta, resolveMealMacros } from '@/lib/mealIngredients';
import { mealTypeLabel } from '@/lib/mealSchedule';
import {
    canShiftLater,
    defaultEatenAt,
    EATEN_STEP_MINUTES,
    formatClockTime,
    mealTimeLabel,
    shiftEatenAt,
} from '@/lib/mealTiming';
import type { Meal } from '@/types';

type MealPlanCardProps = {
  meal: Meal;
  scheduledTime?: string;
  /** Explicit eaten time, so "ate it two hours ago" is recorded as such. */
  onMarkComplete: (status: 'completed' | 'modified' | 'skipped', consumedAt?: string) => void;
  onReplace: () => void;
  onReplaceIngredient?: (ingredientName: string) => void;
  onOpenDetail: () => void;
  /** The meal this slot keeps getting logged with, when it differs from the plan. */
  usual?: MealDefault;
  onUseUsual?: (usual: MealDefault) => void;
  pending?: boolean;
};

export function MealPlanCard({
  meal,
  scheduledTime,
  onMarkComplete,
  onReplace,
  onReplaceIngredient,
  onOpenDetail,
  usual,
  onUseUsual,
  pending = false,
}: MealPlanCardProps) {
  const meta = enrichMealMeta(meal.name, meal.instructions);
  const macros = resolveMealMacros(meal);
  const completed = meal.status === 'completed' || meal.status === 'modified' || meta.status === 'completed';

  const [eatenAt, setEatenAt] = useState(() => defaultEatenAt(meal.scheduledDate));
  const [editingTime, setEditingTime] = useState(false);

  const timeLabel = mealTimeLabel({
    consumedAt: meal.consumedAt,
    scheduledTime,
    eaten: completed,
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${meal.name}, ${mealTypeLabel(meal.mealType)}${completed ? ', logged' : ''}`}
      accessibilityHint="Opens meal details"
      onPress={onOpenDetail}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <View style={styles.titleBlock}>
            <AppText variant="caption" color="accent">
              {timeLabel} · {mealTypeLabel(meal.mealType)}
            </AppText>
            <AppText variant="bodyBold">{meal.name}</AppText>
          </View>
          {completed ? (
            <AppText variant="caption" color="success">
              Complete
            </AppText>
          ) : null}
        </View>

        {!completed && usual && onUseUsual ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Use your usual ${mealTypeLabel(meal.mealType)}, ${usual.name}`}
            style={styles.usualRow}
            disabled={pending}
            onPress={(event) => {
              event.stopPropagation?.();
              onUseUsual(usual);
            }}>
            <AppText variant="caption" color="textSecondary" style={styles.usualText}>
              Your usual: {usual.name}
            </AppText>
            <AppText variant="caption" color="accent">
              Use
            </AppText>
          </Pressable>
        ) : null}

        <View style={styles.ingredients}>
          {(meta.ingredients ?? []).map((ingredient) => (
            <View key={`${meal.id}-${ingredient.name}`} style={styles.ingredientRow}>
              <AppText variant="footnote" color="textSecondary" style={styles.ingredientText}>
                {ingredient.name} · {ingredient.serving}
              </AppText>
              {!completed && onReplaceIngredient ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Replace ${ingredient.name}`}
                  hitSlop={12}
                  onPress={(event) => {
                    event.stopPropagation?.();
                    onReplaceIngredient(ingredient.name);
                  }}>
                  <AppText variant="caption" color="accent">
                    Replace
                  </AppText>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>

        <AppText
          variant="footnote"
          color="textSecondary"
          accessibilityLabel={`${macros.calories} calories, ${Math.round(macros.proteinG)} grams protein, ${Math.round(macros.carbsG)} grams carbs, ${Math.round(macros.fatG)} grams fat`}>
          {macros.calories} cal · {Math.round(macros.proteinG)}P · {Math.round(macros.carbsG)}C · {Math.round(macros.fatG)}F
        </AppText>

        {!completed ? (
          <View style={styles.actions}>
            {editingTime ? (
              <View style={styles.timeRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${EATEN_STEP_MINUTES} minutes earlier`}
                  style={styles.timeStep}
                  onPress={(event) => {
                    event.stopPropagation?.();
                    setEatenAt((current) => shiftEatenAt(current, -EATEN_STEP_MINUTES));
                  }}>
                  <AppText variant="bodyBold">−</AppText>
                </Pressable>
                <View style={styles.timeValue}>
                  <AppText variant="caption" color="textSecondary">
                    Ate at
                  </AppText>
                  <AppText variant="bodyBold">{formatClockTime(eatenAt) ?? 'Now'}</AppText>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${EATEN_STEP_MINUTES} minutes later`}
                  disabled={!canShiftLater(eatenAt, EATEN_STEP_MINUTES)}
                  style={[
                    styles.timeStep,
                    !canShiftLater(eatenAt, EATEN_STEP_MINUTES) && styles.timeStepDisabled,
                  ]}
                  onPress={(event) => {
                    event.stopPropagation?.();
                    setEatenAt((current) => shiftEatenAt(current, EATEN_STEP_MINUTES));
                  }}>
                  <AppText variant="bodyBold">+</AppText>
                </Pressable>
              </View>
            ) : null}

            <PrimaryButton
              label={editingTime ? `Log as eaten at ${formatClockTime(eatenAt) ?? 'now'}` : 'Ate as planned'}
              loading={pending}
              disabled={pending}
              onPress={() => onMarkComplete('completed', editingTime ? eatenAt : undefined)}
            />
            <View style={styles.secondaryRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={editingTime ? 'Use the current time' : 'Set when you ate this'}
                accessibilityState={{ disabled: pending }}
                disabled={pending}
                hitSlop={8}
                style={styles.linkButton}
                onPress={(event) => {
                  event.stopPropagation?.();
                  setEatenAt(defaultEatenAt(meal.scheduledDate));
                  setEditingTime((value) => !value);
                }}>
                <AppText variant="caption" color="accent">
                  {editingTime ? 'Use now' : 'Ate earlier?'}
                </AppText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Log as modified"
                accessibilityState={{ disabled: pending }}
                disabled={pending}
                hitSlop={8}
                style={styles.linkButton}
                onPress={() => onMarkComplete('modified', editingTime ? eatenAt : undefined)}>
                <AppText variant="caption" color="textSecondary">
                  Modified
                </AppText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Log as skipped"
                accessibilityState={{ disabled: pending }}
                disabled={pending}
                hitSlop={8}
                style={styles.linkButton}
                onPress={() => onMarkComplete('skipped')}>
                <AppText variant="caption" color="textSecondary">
                  Skipped
                </AppText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Replace this meal"
                accessibilityState={{ disabled: pending }}
                disabled={pending}
                hitSlop={8}
                style={styles.linkButton}
                onPress={(event) => {
                  event.stopPropagation?.();
                  onReplace();
                }}>
                <AppText variant="caption" color="accent">
                  Replace Meal
                </AppText>
              </Pressable>
            </View>
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  titleBlock: {
    flex: 1,
    gap: Spacing.xs,
  },
  ingredients: {
    gap: Spacing.xs,
  },
  ingredientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.md,
  },
  ingredientText: {
    flex: 1,
  },
  actions: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  secondaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  linkButton: {
    minHeight: TouchTarget.min,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  usualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    minHeight: TouchTarget.min,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  usualText: {
    flex: 1,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  timeStep: {
    minWidth: TouchTarget.min,
    minHeight: TouchTarget.min,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeStepDisabled: {
    opacity: 0.35,
  },
  timeValue: {
    flex: 1,
    alignItems: 'center',
  },
});
