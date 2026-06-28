import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { SmartMealReplaceForm } from '@/components/nutrition/SmartMealReplaceForm';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import {
    alternativesForIngredient,
    enrichMealMeta,
    type MealReplacementReason,
} from '@/lib/mealIngredients';
import { mealTypeLabel } from '@/lib/mealSchedule';
import {
    nutritionAdvisoryService,
    type MealAlternativeOption,
} from '@/services/nutritionAdvisoryService';
import type { Meal } from '@/types';

export type ReplacementMethod = 'custom' | 'ai';

export type SmartReplacementPayload = {
  foodName: string;
  servingSize: string;
  macros: import('@/types/nutrition').FoodMacroEstimate;
  scope: import('@/types/nutrition').MealReplacementScope;
};

type IngredientSwap = {
  from: string;
  to: string;
  reason: string;
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

function buildLocalIngredientSwaps(ingredientName: string): IngredientSwap[] {
  return alternativesForIngredient(ingredientName).map((to) => ({
    from: ingredientName,
    to,
    reason: 'On-device substitute suggestion',
  }));
}

function mergeIngredientSwaps(primary: IngredientSwap[], secondary: IngredientSwap[]): IngredientSwap[] {
  const seen = new Set<string>();
  const merged: IngredientSwap[] = [];

  for (const item of [...primary, ...secondary]) {
    const key = item.to.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged;
}

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
  const [replacementMethod, setReplacementMethod] = useState<ReplacementMethod>('custom');
  const [reason, setReason] = useState<MealReplacementReason>('default');
  const [loading, setLoading] = useState(false);
  const [alternatives, setAlternatives] = useState<MealAlternativeOption[]>([]);
  const [ingredientSwaps, setIngredientSwaps] = useState<IngredientSwap[]>([]);
  const [reasoning, setReasoning] = useState<string | null>(null);
  const [offlineSuggestions, setOfflineSuggestions] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!visible) {
      setReplacementMethod('custom');
      setFetchError(null);
      setOfflineSuggestions(false);
      setAlternatives([]);
      setIngredientSwaps([]);
      setReasoning(null);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || !meal || replacementMethod !== 'ai') return;

    let cancelled = false;
    setLoading(true);
    setFetchError(null);

    if (mode === 'ingredient' && ingredientName) {
      setIngredientSwaps(buildLocalIngredientSwaps(ingredientName));
    }

    void nutritionAdvisoryService.getMealAlternatives(meal, reason, dietaryRestrictions).then((result) => {
      if (cancelled) return;

      if (result.success) {
        setAlternatives(result.data.alternatives);
        setReasoning(result.data.reasoning);
        setOfflineSuggestions(Boolean(result.data.offline));

        if (mode === 'ingredient' && ingredientName) {
          const fromApi = result.data.ingredientAlternatives.filter(
            (item) => item.from.trim().toLowerCase() === ingredientName.trim().toLowerCase() && item.to.trim(),
          );
          setIngredientSwaps((current) => mergeIngredientSwaps(fromApi, current.length ? current : buildLocalIngredientSwaps(ingredientName)));
        } else {
          setIngredientSwaps(result.data.ingredientAlternatives.filter((item) => item.to.trim() && item.to !== item.from));
        }
      } else {
        setFetchError(result.error);
        setAlternatives([]);
        if (mode === 'ingredient' && ingredientName) {
          setIngredientSwaps(buildLocalIngredientSwaps(ingredientName));
        }
      }

      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [visible, meal, mode, ingredientName, reason, dietaryRestrictions, replacementMethod, refreshKey]);

  const visibleIngredientSwaps = useMemo(() => {
    if (mode !== 'ingredient' || !ingredientName) return ingredientSwaps;
    return ingredientSwaps.filter(
      (item) => item.to.trim().toLowerCase() !== ingredientName.trim().toLowerCase(),
    );
  }, [ingredientSwaps, ingredientName, mode]);

  if (!meal) return null;

  const meta = enrichMealMeta(meal.name, meal.instructions);
  const replacingLabel = mode === 'ingredient' && ingredientName ? ingredientName : meal.name;
  const replacingServing =
    mode === 'ingredient' && ingredientName
      ? meta.ingredients?.find((item) => item.name.trim().toLowerCase() === ingredientName.trim().toLowerCase())
          ?.serving ?? ''
      : '';

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
            style={[styles.methodChip, replacementMethod === 'custom' && styles.methodChipActive]}
            onPress={() => setReplacementMethod('custom')}
            testID="custom-replace-button">
            <AppText variant="caption" color={replacementMethod === 'custom' ? 'accent' : 'textSecondary'}>
              Custom
            </AppText>
          </Pressable>
          <Pressable
            style={[styles.methodChip, replacementMethod === 'ai' && styles.methodChipActive]}
            onPress={() => setReplacementMethod('ai')}
            testID="ai-replace-button">
            <AppText variant="caption" color={replacementMethod === 'ai' ? 'accent' : 'textSecondary'}>
              AI suggestions
            </AppText>
          </Pressable>
        </View>

        {replacementMethod === 'custom' ? (
          <SmartMealReplaceForm
            replacingLabel={replacingLabel}
            initialServingSize={replacingServing}
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
            ) : (
              <AppText variant="footnote" color="textSecondary">
                Coach picks for swapping {ingredientName}
              </AppText>
            )}

            {offlineSuggestions ? (
              <View style={styles.offlineBadge}>
                <AppText variant="caption" color="warning">
                  Offline suggestions
                </AppText>
              </View>
            ) : null}

            {fetchError ? (
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

            {reasoning ? (
              <AppText variant="footnote" color="textTertiary">
                {reasoning}
              </AppText>
            ) : null}

            {loading ? (
              <View style={styles.loading}>
                <ActivityIndicator color={LiftFlowColors.accent} />
              </View>
            ) : mode === 'ingredient' ? (
              <View style={styles.list}>
                {visibleIngredientSwaps.length === 0 ? (
                  <AppText variant="footnote" color="textSecondary">
                    No AI swaps for this food yet. Use Custom to log a replacement and calculate macros.
                  </AppText>
                ) : (
                  visibleIngredientSwaps.map((item) => (
                    <Pressable
                      key={`${item.from}-${item.to}`}
                      style={styles.option}
                      onPress={() => {
                        onReplaceIngredient(item.from, item.to);
                        onClose();
                      }}>
                      <AppText variant="body">{item.to}</AppText>
                      {item.reason ? (
                        <AppText variant="caption" color="textSecondary">
                          {item.reason}
                        </AppText>
                      ) : null}
                    </Pressable>
                  ))
                )}
              </View>
            ) : (
              <View style={styles.list}>
                {alternatives.length === 0 ? (
                  <AppText variant="footnote" color="textSecondary">
                    No meal suggestions right now. Try Custom or pick another reason above.
                  </AppText>
                ) : (
                  alternatives.map((option) => (
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
                )}
              </View>
            )}

            {mode === 'meal' && ingredientSwaps.length > 0 ? (
              <View style={styles.ingredientSection}>
                <AppText variant="label" color="textSecondary">
                  Swap an ingredient
                </AppText>
                {ingredientSwaps.map((item) => (
                  <Pressable
                    key={`${item.from}-${item.to}`}
                    style={styles.option}
                    onPress={() => {
                      onReplaceIngredient(item.from, item.to);
                      onClose();
                    }}>
                    <AppText variant="footnote">
                      {item.from} → {item.to}
                    </AppText>
                    {item.reason ? (
                      <AppText variant="caption" color="textTertiary">
                        {item.reason}
                      </AppText>
                    ) : null}
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
