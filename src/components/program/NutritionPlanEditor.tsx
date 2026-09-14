/**
 * Editable review of a nutrition plan read out of a PDF.
 *
 * Targets and meals both come out of a heuristic or an LLM read of a document, so both are worth a
 * second pair of eyes before they become the week's meals and the macro goals every nutrition
 * screen is measured against.
 */

import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { NumberField, TinyButton } from '@/components/program/CycleDayEditor';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { MEAL_TYPES, mealTypeLabel, type DraftMeal, type NutritionDraft } from '@/lib/programImportDraft';

type NutritionPlanEditorProps = {
  nutrition: NutritionDraft;
  onNameChange: (name: string) => void;
  onGoalChange: (key: 'calories' | 'proteinG' | 'carbsG' | 'fatG' | 'waterMl', value: number) => void;
  onDayLabelChange: (dayIndex: number, label: string) => void;
  onMealChange: (dayIndex: number, mealIndex: number, patch: Partial<DraftMeal>) => void;
  onRemoveMeal: (dayIndex: number, mealIndex: number) => void;
  onAddMeal: (dayIndex: number) => void;
};

export function NutritionPlanEditor({
  nutrition,
  onNameChange,
  onGoalChange,
  onDayLabelChange,
  onMealChange,
  onRemoveMeal,
  onAddMeal,
}: NutritionPlanEditorProps) {
  return (
    <>
      <Card style={styles.section}>
        <AppText variant="subhead" color="textSecondary">
          Nutrition plan name
        </AppText>
        <TextInput
          style={styles.input}
          accessibilityLabel="Nutrition plan name"
          placeholder="e.g. Cut Phase"
          placeholderTextColor={LiftFlowColors.textTertiary}
          value={nutrition.name}
          onChangeText={onNameChange}
        />

        <AppText variant="subhead" color="textSecondary">
          Daily targets
        </AppText>
        <AppText variant="caption" color="textTertiary">
          Leave a target at zero to keep the one you already have.
        </AppText>
        <View style={styles.goalRow}>
          <NumberField
            label="Calories"
            value={nutrition.goals.calories ?? 0}
            onChange={(value) => onGoalChange('calories', value)}
          />
          <NumberField
            label="Protein (g)"
            value={nutrition.goals.proteinG ?? 0}
            onChange={(value) => onGoalChange('proteinG', value)}
          />
        </View>
        <View style={styles.goalRow}>
          <NumberField
            label="Carbs (g)"
            value={nutrition.goals.carbsG ?? 0}
            onChange={(value) => onGoalChange('carbsG', value)}
          />
          <NumberField
            label="Fat (g)"
            value={nutrition.goals.fatG ?? 0}
            onChange={(value) => onGoalChange('fatG', value)}
          />
        </View>
      </Card>

      {nutrition.days.length === 0 ? (
        <Card style={styles.section}>
          <AppText variant="body" color="textSecondary">
            No individual meals were read from this plan — only the daily targets above will be
            applied. You can build meals in the Nutrition tab afterwards.
          </AppText>
        </Card>
      ) : null}

      {nutrition.days.map((day) => (
        <Card key={day.dayIndex} style={styles.section}>
          <AppText variant="label" color="accent">
            {day.meals.length} {day.meals.length === 1 ? 'meal' : 'meals'}
          </AppText>
          <TextInput
            style={styles.input}
            accessibilityLabel={`Name for nutrition day ${day.dayIndex + 1}`}
            placeholder="Day name (e.g. Training day)"
            placeholderTextColor={LiftFlowColors.textTertiary}
            value={day.label}
            onChangeText={(text) => onDayLabelChange(day.dayIndex, text)}
          />

          {day.meals.map((meal, mealIndex) => (
            <View key={mealIndex} style={styles.mealRow}>
              <View style={styles.mealMain}>
                <TextInput
                  style={styles.mealName}
                  accessibilityLabel={`Meal ${mealIndex + 1} name`}
                  placeholder="Meal name"
                  placeholderTextColor={LiftFlowColors.textTertiary}
                  value={meal.name}
                  onChangeText={(text) => onMealChange(day.dayIndex, mealIndex, { name: text })}
                />
                <View style={styles.mealTypeRow}>
                  {MEAL_TYPES.map((type) => {
                    const active = meal.mealType.toLowerCase() === type;
                    return (
                      <Pressable
                        key={type}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`${mealTypeLabel(type)} for ${meal.name || `meal ${mealIndex + 1}`}`}
                        style={[styles.mealTypeChip, active && styles.mealTypeChipActive]}
                        onPress={() => onMealChange(day.dayIndex, mealIndex, { mealType: type })}>
                        <AppText variant="caption" color={active ? 'accent' : 'textSecondary'}>
                          {mealTypeLabel(type)}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.mealFields}>
                  <NumberField
                    label="Cal"
                    value={meal.calories ?? 0}
                    onChange={(value) => onMealChange(day.dayIndex, mealIndex, { calories: value })}
                  />
                  <NumberField
                    label="Protein"
                    value={meal.proteinG ?? 0}
                    onChange={(value) => onMealChange(day.dayIndex, mealIndex, { proteinG: value })}
                  />
                  <NumberField
                    label="Carbs"
                    value={meal.carbsG ?? 0}
                    onChange={(value) => onMealChange(day.dayIndex, mealIndex, { carbsG: value })}
                  />
                  <NumberField
                    label="Fat"
                    value={meal.fatG ?? 0}
                    onChange={(value) => onMealChange(day.dayIndex, mealIndex, { fatG: value })}
                  />
                </View>
              </View>
              <TinyButton
                label="✕"
                accessibilityLabel={`Remove ${meal.name || `meal ${mealIndex + 1}`}`}
                onPress={() => onRemoveMeal(day.dayIndex, mealIndex)}
              />
            </View>
          ))}

          <Pressable style={styles.addMeal} onPress={() => onAddMeal(day.dayIndex)}>
            <AppText variant="bodyBold" color="accent">
              + Add meal
            </AppText>
          </Pressable>
        </Card>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.sm },
  input: {
    backgroundColor: LiftFlowColors.surface,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    color: LiftFlowColors.textPrimary,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  goalRow: { flexDirection: 'row', gap: Spacing.sm },
  mealRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.border,
  },
  mealMain: { flex: 1, gap: Spacing.xs },
  mealName: {
    backgroundColor: LiftFlowColors.surfaceElevated,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    color: LiftFlowColors.textPrimary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.border,
  },
  mealTypeRow: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  mealTypeChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.border,
  },
  mealTypeChipActive: {
    borderColor: LiftFlowColors.accentMuted,
    backgroundColor: LiftFlowColors.accentGlow,
  },
  mealFields: { flexDirection: 'row', gap: Spacing.xs },
  addMeal: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.accentMuted,
  },
});
