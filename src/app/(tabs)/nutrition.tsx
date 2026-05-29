import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TextInput, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { nutritionService } from '@/services/nutritionService';
import type { DailyNutritionSummary, GroceryList, Meal, NutritionGoals } from '@/types';

export default function NutritionScreen() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<NutritionGoals | null>(null);
  const [summary, setSummary] = useState<DailyNutritionSummary | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [groceryList, setGroceryList] = useState<GroceryList | null>(null);
  const [loading, setLoading] = useState(true);

  const [foodName, setFoodName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    const [goalsRes, summaryRes, mealsRes] = await Promise.all([
      nutritionService.getGoals(user.id),
      nutritionService.getDailySummary(user.id, today),
      nutritionService.getMealsForDate(user.id, today),
    ]);
    if (goalsRes.success) setGoals(goalsRes.data);
    if (summaryRes.success) setSummary(summaryRes.data);
    if (mealsRes.success) setMeals(mealsRes.data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleLogFood() {
    if (!user || !foodName.trim()) return;
    const result = await nutritionService.logFood(user.id, {
      name: foodName.trim(),
      mealType: 'snack',
      calories: calories ? parseInt(calories, 10) : undefined,
      proteinG: protein ? parseFloat(protein) : undefined,
    });
    if (result.success) {
      setFoodName('');
      setCalories('');
      setProtein('');
      load();
    } else {
      Alert.alert('Error', result.error);
    }
  }

  async function handleGenerateMealPlan() {
    if (!user) return;
    setLoading(true);
    const result = await nutritionService.generateWeeklyMealPlan(user.id);
    setLoading(false);
    if (result.success) Alert.alert('Meal plan created', result.data.name);
    else Alert.alert('Error', result.error);
  }

  async function handleGenerateGroceryList() {
    if (!user) return;
    const result = await nutritionService.generateGroceryList(user.id);
    if (result.success) setGroceryList(result.data);
    else Alert.alert('Error', result.error);
  }

  if (loading && !summary) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={LiftFlowColors.accent} />
      </View>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <AppText variant="title">Nutrition</AppText>
        <AppText variant="body" color="textSecondary">
          Track macros and meals
        </AppText>
      </View>

      <View style={styles.macroRow}>
        <MacroCard label="Calories" current={summary?.caloriesConsumed ?? 0} target={goals?.dailyCalories} unit="" />
        <MacroCard label="Protein" current={Math.round(summary?.proteinG ?? 0)} target={goals?.proteinG} unit="g" />
        <MacroCard label="Carbs" current={Math.round(summary?.carbsG ?? 0)} target={goals?.carbsG} unit="g" />
        <MacroCard label="Fat" current={Math.round(summary?.fatG ?? 0)} target={goals?.fatG} unit="g" />
      </View>

      <SectionHeader title="Log Food" />
      <Card style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Food name"
          placeholderTextColor={LiftFlowColors.textTertiary}
          value={foodName}
          onChangeText={setFoodName}
        />
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, styles.inputHalf]}
            placeholder="Calories"
            placeholderTextColor={LiftFlowColors.textTertiary}
            keyboardType="numeric"
            value={calories}
            onChangeText={setCalories}
          />
          <TextInput
            style={[styles.input, styles.inputHalf]}
            placeholder="Protein (g)"
            placeholderTextColor={LiftFlowColors.textTertiary}
            keyboardType="numeric"
            value={protein}
            onChangeText={setProtein}
          />
        </View>
        <PrimaryButton label="Add Food" onPress={handleLogFood} />
      </Card>

      <SectionHeader title="Today's Meals" />
      {meals.length === 0 ? (
        <AppText variant="body" color="textSecondary">
          No meals logged today.
        </AppText>
      ) : (
        meals.map((meal) => (
          <Card key={meal.id} style={styles.mealCard}>
            <AppText variant="bodyBold">{meal.name}</AppText>
            <AppText variant="footnote" color="textSecondary">
              {meal.calories ?? 0} cal · {meal.proteinG ?? 0}g protein
            </AppText>
          </Card>
        ))
      )}

      <SectionHeader title="Meal Planning" />
      <View style={styles.buttonRow}>
        <PrimaryButton label="Weekly Meal Plan" onPress={handleGenerateMealPlan} variant="secondary" />
        <PrimaryButton label="Shopping List" onPress={handleGenerateGroceryList} variant="secondary" />
      </View>

      {groceryList ? (
        <Card style={styles.groceryCard}>
          <AppText variant="bodyBold">{groceryList.name}</AppText>
          {groceryList.items.map((item) => (
            <AppText key={item.id} variant="footnote" color="textSecondary">
              • {item.name}
            </AppText>
          ))}
        </Card>
      ) : null}
    </ScreenContainer>
  );
}

function MacroCard({
  label,
  current,
  target,
  unit,
}: {
  label: string;
  current: number;
  target?: number;
  unit: string;
}) {
  return (
    <Card style={styles.macroCard}>
      <AppText variant="caption" color="textSecondary">
        {label}
      </AppText>
      <AppText variant="bodyBold">
        {current}
        {unit}
      </AppText>
      {target ? (
        <AppText variant="caption" color="textTertiary">
          / {target}
          {unit}
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LiftFlowColors.background,
  },
  header: {
    gap: Spacing.xs,
    marginBottom: Spacing.xxl,
  },
  macroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  macroCard: {
    width: '47%',
    gap: Spacing.xs,
  },
  form: {
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  input: {
    backgroundColor: LiftFlowColors.background,
    borderRadius: 8,
    padding: Spacing.md,
    color: LiftFlowColors.textPrimary,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  inputRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  inputHalf: {
    flex: 1,
  },
  mealCard: {
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  buttonRow: {
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  groceryCard: {
    gap: Spacing.sm,
    marginBottom: Spacing.xxl,
  },
});
