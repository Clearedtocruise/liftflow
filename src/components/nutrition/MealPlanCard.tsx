import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { Spacing } from '@/constants/theme';
import { enrichMealMeta } from '@/lib/mealIngredients';
import { mealTypeLabel } from '@/lib/mealSchedule';
import type { Meal } from '@/types';

type MealPlanCardProps = {
  meal: Meal;
  scheduledTime?: string;
  onMarkComplete: (status: 'completed' | 'modified' | 'skipped') => void;
  onReplace: () => void;
  onReplaceIngredient?: (ingredientName: string) => void;
  onOpenDetail: () => void;
};

export function MealPlanCard({
  meal,
  scheduledTime,
  onMarkComplete,
  onReplace,
  onReplaceIngredient,
  onOpenDetail,
}: MealPlanCardProps) {
  const meta = enrichMealMeta(meal.name, meal.instructions);
  const completed = meta.status === 'completed';

  return (
    <Pressable onPress={onOpenDetail}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <View style={styles.titleBlock}>
            <AppText variant="caption" color="accent">
              {scheduledTime ?? 'Scheduled'} · {mealTypeLabel(meal.mealType)}
            </AppText>
            <AppText variant="bodyBold">{meal.name}</AppText>
          </View>
          {completed ? (
            <AppText variant="caption" color="success">
              Complete
            </AppText>
          ) : null}
        </View>

        <View style={styles.ingredients}>
          {(meta.ingredients ?? []).map((ingredient) => (
            <View key={`${meal.id}-${ingredient.name}`} style={styles.ingredientRow}>
              <AppText variant="footnote" color="textSecondary" style={styles.ingredientText}>
                {ingredient.name} · {ingredient.serving}
              </AppText>
              {!completed && onReplaceIngredient ? (
                <Pressable
                  hitSlop={8}
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

        <AppText variant="footnote" color="textSecondary">
          {meal.calories ?? 0} cal · {Math.round(meal.proteinG ?? 0)}P · {Math.round(meal.carbsG ?? 0)}C · {Math.round(meal.fatG ?? 0)}F
        </AppText>

        {!completed ? (
          <View style={styles.actions}>
            <PrimaryButton label="Ate as planned" onPress={() => onMarkComplete('completed')} />
            <View style={styles.secondaryRow}>
              <Pressable style={styles.linkButton} onPress={() => onMarkComplete('modified')}>
                <AppText variant="caption" color="textSecondary">
                  Modified
                </AppText>
              </Pressable>
              <Pressable style={styles.linkButton} onPress={() => onMarkComplete('skipped')}>
                <AppText variant="caption" color="textSecondary">
                  Skipped
                </AppText>
              </Pressable>
              <Pressable
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
    paddingVertical: Spacing.xs,
  },
});
