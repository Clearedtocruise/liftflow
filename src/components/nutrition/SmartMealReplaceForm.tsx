import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { TextField } from '@/components/layout/TextField';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { nutritionAdvisoryService } from '@/services/nutritionAdvisoryService';
import { sumMealMacros } from '@/services/nutritionService';
import type { FoodMacroEstimate, MealReplacementScope } from '@/types/nutrition';

export type SmartReplaceItemPayload = {
  foodName: string;
  servingSize: string;
  macros: FoodMacroEstimate;
};

export type SmartMealReplaceConfirmPayload = {
  foodName: string;
  servingSize: string;
  macros: FoodMacroEstimate;
  items: SmartReplaceItemPayload[];
  scope: MealReplacementScope;
};

type ItemRow = {
  id: string;
  foodName: string;
  servingSize: string;
  macros: FoodMacroEstimate | null;
  reasoning: string | null;
};

type SmartMealReplaceFormProps = {
  replacingLabel: string;
  initialFoodName?: string;
  initialServingSize?: string;
  /** When false (ingredient mode), only a single item row is allowed. */
  allowMultiple?: boolean;
  onConfirm: (payload: SmartMealReplaceConfirmPayload) => void;
};

const SCOPE_OPTIONS: Array<{ id: MealReplacementScope; label: string }> = [
  { id: 'meal', label: 'This meal only' },
  { id: 'day', label: 'This day only' },
  { id: 'week', label: 'Entire week' },
];

let nextRowId = 1;
function createRow(foodName = '', servingSize = ''): ItemRow {
  return {
    id: `item-${nextRowId++}`,
    foodName,
    servingSize,
    macros: null,
    reasoning: null,
  };
}

function defaultMealTitle(rows: ItemRow[]): string {
  return rows
    .map((row) => row.foodName.trim())
    .filter(Boolean)
    .join(', ');
}

export function SmartMealReplaceForm({
  replacingLabel,
  initialFoodName = '',
  initialServingSize = '',
  allowMultiple = true,
  onConfirm,
}: SmartMealReplaceFormProps) {
  const [rows, setRows] = useState<ItemRow[]>(() => [createRow(initialFoodName, initialServingSize)]);
  const [mealTitle, setMealTitle] = useState(initialFoodName);
  const [titleTouched, setTitleTouched] = useState(Boolean(initialFoodName.trim()));
  const [scope, setScope] = useState<MealReplacementScope>('meal');
  const [loading, setLoading] = useState(false);
  const [totals, setTotals] = useState<FoodMacroEstimate | null>(null);

  useEffect(() => {
    setRows([createRow(initialFoodName, initialServingSize)]);
    setMealTitle(initialFoodName);
    setTitleTouched(Boolean(initialFoodName.trim()));
    setTotals(null);
  }, [initialFoodName, initialServingSize, replacingLabel, allowMultiple]);

  const filledRows = useMemo(
    () => rows.filter((row) => row.foodName.trim() && row.servingSize.trim()),
    [rows],
  );

  const allRowsComplete = rows.length > 0 && rows.every((row) => row.foodName.trim() && row.servingSize.trim());
  const canCalculate = filledRows.length > 0 && allRowsComplete;

  function updateRow(id: string, patch: Partial<Pick<ItemRow, 'foodName' | 'servingSize'>>) {
    setRows((current) =>
      current.map((row) =>
        row.id === id
          ? { ...row, ...patch, macros: null, reasoning: null }
          : row,
      ),
    );
    setTotals(null);
  }

  function addRow() {
    if (!allowMultiple) return;
    setRows((current) => [...current, createRow()]);
    setTotals(null);
  }

  function removeRow(id: string) {
    setRows((current) => {
      if (current.length <= 1) return current;
      return current.filter((row) => row.id !== id);
    });
    setTotals(null);
  }

  async function handleCalculate() {
    if (!canCalculate) return;
    setLoading(true);
    setTotals(null);

    const estimated: ItemRow[] = [];
    for (const row of rows) {
      const result = await nutritionAdvisoryService.estimateFoodMacros(
        row.foodName.trim(),
        row.servingSize.trim(),
      );
      if (!result.success) {
        setLoading(false);
        return;
      }
      estimated.push({
        ...row,
        macros: result.data,
        reasoning: result.data.reasoning ?? null,
      });
    }

    const results = estimated.map((item) => ({ macros: item.macros! }));
    const summed = sumMealMacros(results.map((item) => item.macros));
    setRows(estimated);
    setTotals(summed);
    if (!titleTouched) {
      setMealTitle(defaultMealTitle(estimated));
    }
    setLoading(false);
  }

  const resolvedTitle = (mealTitle.trim() || defaultMealTitle(rows)).trim();
  const confirmServing =
    rows.length === 1 ? rows[0]!.servingSize.trim() : `${rows.length} items`;

  return (
    <View style={styles.container} testID="smart-replace-form">
      <AppText variant="footnote" color="textSecondary">
        What are you eating instead of {replacingLabel}?
      </AppText>

      {rows.map((row, index) => (
        <View key={row.id} style={styles.itemCard}>
          <View style={styles.itemHeader}>
            <AppText variant="label" color="textSecondary">
              {allowMultiple ? (index === 0 ? 'Entrée' : `Side ${index}`) : 'Food'}
            </AppText>
            {allowMultiple && rows.length > 1 ? (
              <Pressable onPress={() => removeRow(row.id)} hitSlop={8}>
                <AppText variant="caption" color="accent">
                  Remove
                </AppText>
              </Pressable>
            ) : null}
          </View>
          <TextField
            label="Food"
            value={row.foodName}
            onChangeText={(value) => updateRow(row.id, { foodName: value })}
            placeholder="Greek yogurt"
          />
          <TextField
            label="Serving size"
            value={row.servingSize}
            onChangeText={(value) => updateRow(row.id, { servingSize: value })}
            placeholder="1 cup"
          />
          {row.macros ? (
            <AppText variant="caption" color="textTertiary">
              {row.macros.calories} cal · {row.macros.proteinG}P · {row.macros.carbsG}C · {row.macros.fatG}F
              {row.reasoning ? ` · ${row.reasoning}` : ''}
            </AppText>
          ) : null}
        </View>
      ))}

      {allowMultiple ? (
        <Pressable style={styles.addItem} onPress={addRow} testID="add-replace-item-button">
          <AppText variant="caption" color="accent">
            + Add side
          </AppText>
        </Pressable>
      ) : null}

      {allowMultiple ? (
        <TextField
          label="Meal title"
          value={mealTitle}
          onChangeText={(value) => {
            setTitleTouched(true);
            setMealTitle(value);
          }}
          placeholder={defaultMealTitle(rows) || 'Greek yogurt, granola, honey'}
        />
      ) : null}

      <PrimaryButton
        label={loading ? 'Calculating…' : 'Calculate Macros'}
        variant="secondary"
        loading={loading}
        disabled={!canCalculate}
        onPress={handleCalculate}
      />

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={LiftFlowColors.accent} />
        </View>
      ) : null}

      {totals ? (
        <View style={styles.preview}>
          <AppText variant="label" color="accent">
            {rows.length > 1 ? 'Total estimated nutrition' : 'Estimated nutrition'}
          </AppText>
          <View style={styles.macroGrid}>
            <MacroCell label="Calories" value={String(Math.round(totals.calories))} />
            <MacroCell label="Protein" value={`${Math.round(totals.proteinG * 10) / 10}g`} />
            <MacroCell label="Carbs" value={`${Math.round(totals.carbsG * 10) / 10}g`} />
            <MacroCell label="Fat" value={`${Math.round(totals.fatG * 10) / 10}g`} />
          </View>
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
        disabled={!totals || !allRowsComplete || !resolvedTitle}
        testID="confirm-replacement-button"
        onPress={() => {
          if (!totals || !allRowsComplete) return;
          const items: SmartReplaceItemPayload[] = rows.map((row) => ({
            foodName: row.foodName.trim(),
            servingSize: row.servingSize.trim(),
            macros: row.macros!,
          }));
          onConfirm({
            foodName: allowMultiple ? resolvedTitle : items[0]!.foodName,
            servingSize: confirmServing,
            macros: totals,
            items,
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
  itemCard: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.surface,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addItem: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.xs,
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
