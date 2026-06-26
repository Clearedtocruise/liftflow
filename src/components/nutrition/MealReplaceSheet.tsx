import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { SmartMealReplaceForm } from '@/components/nutrition/SmartMealReplaceForm';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { enrichMealMeta, type MealReplacementReason } from '@/lib/mealIngredients';
import { mealTypeLabel } from '@/lib/mealSchedule';
import {
    nutritionAdvisoryService,
    type MealAlternativeOption,
} from '@/services/nutritionAdvisoryService';
import type { Meal } from '@/types';
import type { FoodMacroEstimate, MealReplacementScope } from '@/types/nutrition';

export type ReplacementMethod = 'smart' | 'ai';

export type SmartReplacementPayload = {
  foodName: string;
  servingSize: string;
  macros: FoodMacroEstimate;
  scope: MealReplacementScope;
};

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
  onSmartReplace: (payload: SmartReplacementPayload) => void;
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
  onSmartReplace,
}: MealReplaceSheetProps) {
  const [replacementMethod, setReplacementMethod] = useState<ReplacementMethod>('smart');
  const [reason, setReason] = useState<MealReplacementReason>('default');
  const [loading, setLoading] = useState(false);
  const [alternatives, setAlternatives] = useState<MealAlternativeOption[]>([]);
  const [ingredientAlternatives, setIngredientAlternatives] = useState<
    Array<{ from: string; to: string; reason: string }>
  >([]);
  const [reasoning, setReasoning] = useState<string | null>(null);
  const [offlineSuggestions, setOfflineSuggestions] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!visible) {
      setReplacementMethod('smart');
      setFetchError(null);
      setOfflineSuggestions(false);
      return;
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || !meal || mode !== 'meal' || replacementMethod !== 'ai') return;

    let cancelled = false;
    setLoading(true);
    setFetchError(null);

    void nutritionAdvisoryService.getMealAlternatives(meal, reason, dietaryRestrictions).then((result) => {
      if (cancelled) return;
      if (result.success) {
        setAlternatives(result.data.alternatives);
        setIngredientAlternatives(result.data.ingredientAlternatives);
        setReasoning(result.data.reasoning);
        setOfflineSuggestions(Boolean(result.data.offline));
      } else {
        setFetchError(result.error);
        setAlternatives([]);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [visible, meal, mode, reason, dietaryRestrictions, replacementMethod, refreshKey]);

  if (!meal) return null;

  const meta = enrichMealMeta(meal.name, meal.instructions);
  const replacingLabel = mode === 'ingredient' && ingredientName ? ingredientName : meal.name;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView contentContainerStyle={styles.container}>
        <AppText variant="title">{mode === 'ingredient' ? 'Replace Food' : 'Replace Meal'}</AppText>
        <AppText variant="footnote" color="textSecondary">
          {scheduledTime ?? 'Scheduled'} · {mealTypeLabel(meal.mealType)}
        </AppText>
        <AppText variant="bodyBold">{replacingLabel}</AppText>

        <View style={styles.methodRow}>
          <Pressable
            style={[styles.methodChip, replacementMethod === 'smart' && styles.methodChipActive]}
            onPress={() => setReplacementMethod('smart')}
            testID="smart-replace-button">
            <AppText variant="caption" color={replacementMethod === 'smart' ? 'accent' : 'textSecondary'}>
              Smart Replacement
            </AppText>
          </Pressable>
          <Pressable
            style={[styles.methodChip, replacementMethod === 'ai' && styles.methodChipActive]}
            onPress={() => setReplacementMethod('ai')}>
            <AppText variant="caption" color={replacementMethod === 'ai' ? 'accent' : 'textSecondary'}>
              AI Replacement
            </AppText>
          </Pressable>
        </View>

        {replacementMethod === 'smart' ? (
          <SmartMealReplaceForm
            replacingLabel={replacingLabel}
            onConfirm={(payload) => {
              onSmartReplace(payload);
              onClose();
            }}
          />
        ) : (
          <>
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

            {offlineSuggestions && mode === 'meal' ? (
              <View style={styles.offlineBadge}>
                <AppText variant="caption" color="warning">
                  Offline suggestions
                </AppText>
              </View>
            ) : null}

            {fetchError && mode === 'meal' ? (
              <View style={styles.errorRow}>
                <AppText variant="footnote" color="textSecondary">
                  {fetchError}
                </AppText>
                <Pressable onPress={() => setRefreshKey((key) => key + 1)}>
                  <AppText variant="caption" color="accent">
                    Retry
                  </AppText>
                </Pressable>
              </View>
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
              <View style={styles.list}>
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
              </View>
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
          </>
        )}

        <PrimaryButton label="Close" variant="secondary" onPress={onClose} />
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: LiftFlowColors.background,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  methodRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  methodChip: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: LiftFlowColors.surfaceElevated,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    alignItems: 'center',
  },
  methodChipActive: {
    borderColor: LiftFlowColors.accent,
    backgroundColor: LiftFlowColors.accentGlow,
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
  offlineBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: LiftFlowColors.surfaceElevated,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
});
