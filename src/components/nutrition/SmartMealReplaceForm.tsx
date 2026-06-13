import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { TextField } from '@/components/layout/TextField';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { nutritionAdvisoryService } from '@/services/nutritionAdvisoryService';
import type { FoodMacroEstimate, MealReplacementScope } from '@/types/nutrition';

type SmartMealReplaceFormProps = {
  replacingLabel: string;
  onConfirm: (payload: {
    foodName: string;
    servingSize: string;
    macros: FoodMacroEstimate;
    scope: MealReplacementScope;
  }) => void;
};

const SCOPE_OPTIONS: Array<{ id: MealReplacementScope; label: string }> = [
  { id: 'meal', label: 'This meal only' },
  { id: 'day', label: 'This day only' },
  { id: 'week', label: 'Entire week' },
];

export function SmartMealReplaceForm({ replacingLabel, onConfirm }: SmartMealReplaceFormProps) {
  const [foodName, setFoodName] = useState('');
  const [servingSize, setServingSize] = useState('');
  const [scope, setScope] = useState<MealReplacementScope>('meal');
  const [loading, setLoading] = useState(false);
  const [macros, setMacros] = useState<FoodMacroEstimate | null>(null);
  const [reasoning, setReasoning] = useState<string | null>(null);

  async function handleCalculate() {
    if (!foodName.trim() || !servingSize.trim()) return;
    setLoading(true);
    setMacros(null);
    const result = await nutritionAdvisoryService.estimateFoodMacros(foodName.trim(), servingSize.trim());
    if (result.success) {
      setMacros(result.data);
      setReasoning(result.data.reasoning ?? null);
    }
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <AppText variant="footnote" color="textSecondary">
        Replacing: {replacingLabel}
      </AppText>

      <TextField
        label="Food"
        value={foodName}
        onChangeText={setFoodName}
        placeholder="Lean Ground Beef"
      />
      <TextField
        label="Serving size"
        value={servingSize}
        onChangeText={setServingSize}
        placeholder="6 oz"
      />

      <PrimaryButton
        label={loading ? 'Calculating…' : 'Calculate Macros'}
        variant="secondary"
        loading={loading}
        disabled={!foodName.trim() || !servingSize.trim()}
        onPress={handleCalculate}
      />

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={LiftFlowColors.accent} />
        </View>
      ) : null}

      {macros ? (
        <View style={styles.preview}>
          <AppText variant="label" color="accent">
            Estimated nutrition
          </AppText>
          <View style={styles.macroGrid}>
            <MacroCell label="Calories" value={String(macros.calories)} />
            <MacroCell label="Protein" value={`${macros.proteinG}g`} />
            <MacroCell label="Carbs" value={`${macros.carbsG}g`} />
            <MacroCell label="Fat" value={`${macros.fatG}g`} />
          </View>
          {reasoning ? (
            <AppText variant="caption" color="textTertiary">
              {reasoning}
            </AppText>
          ) : null}
        </View>
      ) : null}

      <AppText variant="label" color="textSecondary">
        Apply to
      </AppText>
      <View style={styles.scopeRow}>
        {SCOPE_OPTIONS.map((option) => (
          <Pressable
            key={option.id}
            style={[styles.scopeChip, scope === option.id && styles.scopeChipActive]}
            onPress={() => setScope(option.id)}>
            <AppText variant="caption" color={scope === option.id ? 'accent' : 'textSecondary'}>
              {option.label}
            </AppText>
          </Pressable>
        ))}
      </View>

      <PrimaryButton
        label="Confirm Replacement"
        disabled={!macros || !foodName.trim() || !servingSize.trim()}
        onPress={() => {
          if (!macros) return;
          onConfirm({
            foodName: foodName.trim(),
            servingSize: servingSize.trim(),
            macros,
            scope,
          });
        }}
      />
    </View>
  );
}

function MacroCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.macroCell}>
      <AppText variant="caption" color="textSecondary">
        {label}
      </AppText>
      <AppText variant="bodyBold">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  loading: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  preview: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.surface,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  macroCell: {
    minWidth: '40%',
    gap: 2,
  },
  scopeRow: {
    gap: Spacing.sm,
  },
  scopeChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: LiftFlowColors.surfaceElevated,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  scopeChipActive: {
    borderColor: LiftFlowColors.accent,
    backgroundColor: LiftFlowColors.accentGlow,
  },
});
