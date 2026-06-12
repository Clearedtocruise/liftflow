import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { alternativesForIngredient, enrichMealMeta, mealAlternatives } from '@/lib/mealIngredients';
import { mealTypeLabel } from '@/lib/mealSchedule';
import type { Meal } from '@/types';

type MealReplaceSheetProps = {
  visible: boolean;
  meal: Meal | null;
  scheduledTime?: string;
  mode: 'meal' | 'ingredient';
  ingredientName?: string;
  onClose: () => void;
  onReplaceMeal: (newName: string, reason: string) => void;
  onReplaceIngredient: (ingredientName: string, replacement: string) => void;
};

const MEAL_REASONS = [
  { id: 'default', label: "I don't want this" },
  { id: 'faster', label: 'Need faster option' },
  { id: 'restaurant', label: 'Need restaurant option' },
  { id: 'higher_protein', label: 'Need higher protein' },
  { id: 'lower_calorie', label: 'Need lower calories' },
];

export function MealReplaceSheet({
  visible,
  meal,
  scheduledTime,
  mode,
  ingredientName,
  onClose,
  onReplaceMeal,
  onReplaceIngredient,
}: MealReplaceSheetProps) {
  if (!meal) return null;

  const meta = enrichMealMeta(meal.name, meal.instructions);
  const options =
    mode === 'ingredient' && ingredientName
      ? alternativesForIngredient(ingredientName)
      : mealAlternatives(meal.name, 'default');

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <AppText variant="title">{mode === 'ingredient' ? 'Replace Ingredient' : 'Replace Meal'}</AppText>
        <AppText variant="footnote" color="textSecondary">
          {scheduledTime ?? 'Scheduled'} · {mealTypeLabel(meal.mealType)}
        </AppText>
        <AppText variant="bodyBold">{mode === 'ingredient' ? ingredientName : meal.name}</AppText>

        {mode === 'meal' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reasonRow}>
            {MEAL_REASONS.map((reason) => (
              <Pressable
                key={reason.id}
                style={styles.reasonChip}
                onPress={() => {
                  const alt = mealAlternatives(meal.name, reason.id)[0];
                  onReplaceMeal(alt, reason.id);
                  onClose();
                }}>
                <AppText variant="caption">{reason.label}</AppText>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <ScrollView contentContainerStyle={styles.list}>
          {options.map((option) => (
            <Pressable
              key={option}
              style={styles.option}
              onPress={() => {
                if (mode === 'ingredient' && ingredientName) {
                  onReplaceIngredient(ingredientName, option);
                } else {
                  onReplaceMeal(option, 'default');
                }
                onClose();
              }}>
              <AppText variant="body">{option}</AppText>
            </Pressable>
          ))}
        </ScrollView>

        {mode === 'meal' ? (
          <View style={styles.ingredientSection}>
            <AppText variant="label" color="textSecondary">
              Replace ingredient
            </AppText>
            {(meta.ingredients ?? []).map((ingredient) => (
              <Pressable key={ingredient.name} style={styles.option} onPress={() => onReplaceIngredient(ingredient.name, alternativesForIngredient(ingredient.name)[0])}>
                <AppText variant="footnote">
                  {ingredient.name} → {alternativesForIngredient(ingredient.name)[0]}
                </AppText>
              </Pressable>
            ))}
          </View>
        ) : null}

        <PrimaryButton label="Close" variant="secondary" onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LiftFlowColors.background,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  reasonRow: {
    gap: Spacing.sm,
  },
  reasonChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: LiftFlowColors.surfaceElevated,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    marginRight: Spacing.sm,
  },
  list: {
    gap: Spacing.sm,
  },
  option: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.surface,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  ingredientSection: {
    gap: Spacing.sm,
  },
});
