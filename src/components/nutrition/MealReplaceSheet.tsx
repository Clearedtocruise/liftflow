import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { enrichMealMeta, type MealReplacementReason } from '@/lib/mealIngredients';
import { mealTypeLabel } from '@/lib/mealSchedule';
import {
  nutritionAdvisoryService,
  type MealAlternativeOption,
} from '@/services/nutritionAdvisoryService';
import type { Meal } from '@/types';

type MealReplaceSheetProps = {
  visible: boolean;
  meal: Meal | null;
  scheduledTime?: string;
  mode: 'meal' | 'ingredient';
  ingredientName?: string;
  dietaryRestrictions?: string[];
  onClose: () => void;
  onReplaceMeal: (option: MealAlternativeOption, reason: MealReplacementReason) => void;
  onReplaceIngredient: (ingredientName: string, replacement: string) => void;
};

const MEAL_REASONS: Array<{ id: MealReplacementReason; label: string }> = [
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
  dietaryRestrictions = [],
  onClose,
  onReplaceMeal,
  onReplaceIngredient,
}: MealReplaceSheetProps) {
  const [reason, setReason] = useState<MealReplacementReason>('default');
  const [loading, setLoading] = useState(false);
  const [alternatives, setAlternatives] = useState<MealAlternativeOption[]>([]);
  const [ingredientAlternatives, setIngredientAlternatives] = useState<
    Array<{ from: string; to: string; reason: string }>
  >([]);
  const [reasoning, setReasoning] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !meal || mode !== 'meal') return;

    let cancelled = false;
    setLoading(true);

    void nutritionAdvisoryService.getMealAlternatives(meal, reason, dietaryRestrictions).then((result) => {
      if (cancelled) return;
      if (result.success) {
        setAlternatives(result.data.alternatives);
        setIngredientAlternatives(result.data.ingredientAlternatives);
        setReasoning(result.data.reasoning);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [visible, meal, mode, reason, dietaryRestrictions]);

  if (!meal) return null;

  const meta = enrichMealMeta(meal.name, meal.instructions);

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
            {MEAL_REASONS.map((item) => (
              <Pressable
                key={item.id}
                style={[styles.reasonChip, reason === item.id && styles.reasonChipActive]}
                onPress={() => setReason(item.id)}>
                <AppText variant="caption" color={reason === item.id ? 'accent' : 'textSecondary'}>
                  {item.label}
                </AppText>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {reasoning && mode === 'meal' ? (
          <AppText variant="footnote" color="textTertiary">
            {reasoning}
          </AppText>
        ) : null}

        {loading && mode === 'meal' ? (
          <View style={styles.loading}>
            <ActivityIndicator color={LiftFlowColors.accent} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {mode === 'meal'
              ? alternatives.map((option) => (
                  <Pressable
                    key={option.name}
                    style={styles.option}
                    onPress={() => {
                      onReplaceMeal(option, reason);
                      onClose();
                    }}>
                    <AppText variant="body">{option.name}</AppText>
                    <AppText variant="caption" color="textSecondary">
                      {option.calories} cal · {Math.round(option.proteinG)}P · {Math.round(option.carbsG)}C ·{' '}
                      {Math.round(option.fatG)}F
                    </AppText>
                  </Pressable>
                ))
              : null}
          </ScrollView>
        )}

        {mode === 'meal' ? (
          <View style={styles.ingredientSection}>
            <AppText variant="label" color="textSecondary">
              Replace ingredient
            </AppText>
            {(ingredientAlternatives.length > 0 ? ingredientAlternatives : (meta.ingredients ?? []).map((item) => ({
              from: item.name,
              to: item.name,
              reason: '',
            }))).map((item) => (
              <Pressable
                key={item.from}
                style={styles.option}
                onPress={() => {
                  if (item.to && item.to !== item.from) {
                    onReplaceIngredient(item.from, item.to);
                    onClose();
                  }
                }}>
                <AppText variant="footnote">
                  {item.from} → {item.to}
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
  reasonChipActive: {
    borderColor: LiftFlowColors.accent,
    backgroundColor: LiftFlowColors.accentGlow,
  },
  loading: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
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
    gap: Spacing.xs,
  },
  ingredientSection: {
    gap: Spacing.sm,
  },
});
