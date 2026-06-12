import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { MealPlanCard } from '@/components/nutrition/MealPlanCard';
import { MealReplaceSheet } from '@/components/nutrition/MealReplaceSheet';
import { NutritionProgressHeader } from '@/components/nutrition/NutritionProgressHeader';
import { NutritionSectionTabs, type NutritionSection } from '@/components/nutrition/NutritionSectionTabs';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { aggregateWeeklyGroceries } from '@/lib/groceryAggregation';
import {
    enrichMealMeta,
    ingredientsForMealName,
    serializeMealMeta,
} from '@/lib/mealIngredients';
import { scheduleFromProfile, scheduledTimesForDay } from '@/lib/mealSchedule';
import { WEEKDAY_LABELS, getWeekRange } from '@/lib/weekPlan';
import { nutritionService } from '@/services/nutritionService';
import { trainingService } from '@/services/trainingService';
import type { DailyNutritionSummary, GroceryList, Meal, NutritionGoals } from '@/types';

export default function NutritionScreen() {
  const { user } = useAuth();
  const [section, setSection] = useState<NutritionSection>('today');
  const [goals, setGoals] = useState<NutritionGoals | null>(null);
  const [summary, setSummary] = useState<DailyNutritionSummary | null>(null);
  const [weekMeals, setWeekMeals] = useState<Meal[]>([]);
  const [groceryList, setGroceryList] = useState<GroceryList | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [replaceMeal, setReplaceMeal] = useState<Meal | null>(null);
  const [replaceMode, setReplaceMode] = useState<'meal' | 'ingredient'>('meal');
  const [detailMeal, setDetailMeal] = useState<Meal | null>(null);
  const [hasWorkoutToday, setHasWorkoutToday] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const schedule = scheduleFromProfile(user, hasWorkoutToday);

  const load = useCallback(async () => {
    if (!user) return;
    const { from, to } = getWeekRange();
    const [goalsRes, summaryRes, weekRes, dashRes] = await Promise.all([
      nutritionService.getGoals(user.id),
      nutritionService.getDailySummary(user.id, today),
      nutritionService.getMealsForWeek(user.id, from, to),
      trainingService.getDashboard(user.id),
    ]);
    if (goalsRes.success) setGoals(goalsRes.data);
    if (summaryRes.success) setSummary(summaryRes.data);
    if (weekRes.success) setWeekMeals(weekRes.data);
    if (dashRes.success) setHasWorkoutToday(Boolean(dashRes.data.nextWorkout));
    setLoading(false);
  }, [user, today]);

  useEffect(() => {
    load();
  }, [load]);

  const todayMeals = useMemo(() => weekMeals.filter((meal) => meal.scheduledDate === today), [weekMeals, today]);
  const todayTimes = useMemo(
    () => scheduledTimesForDay(todayMeals.map((meal) => meal.mealType), schedule, hasWorkoutToday),
    [todayMeals, schedule, hasWorkoutToday],
  );

  const mealsCompleted = todayMeals.filter((meal) => enrichMealMeta(meal.name, meal.instructions).status === 'completed').length;

  const weekDays = useMemo(() => {
    const { dates } = getWeekRange();
    return dates.map((date, index) => ({
      date,
      label: WEEKDAY_LABELS[index],
      meals: weekMeals.filter((meal) => meal.scheduledDate === date),
    }));
  }, [weekMeals]);

  const shoppingItems = useMemo(() => {
    if (groceryList?.items?.length) return groceryList.items;
    return aggregateWeeklyGroceries(weekMeals).map((item, index) => ({
      id: `local-${index}`,
      name: item.name,
      quantity: parseFloat(item.quantity) || 1,
      unit: item.quantity.replace(/^[\d.]+\s*/, '') || 'serving',
      category: item.category,
      isChecked: false,
      sortOrder: index,
    }));
  }, [groceryList, weekMeals]);

  async function ensureMealPlan() {
    if (!user) return;
    if (weekMeals.length > 0) return;
    setLoading(true);
    const result = await nutritionService.generateWeeklyMealPlan(user.id);
    setLoading(false);
    if (result.success) await load();
    else Alert.alert('Error', result.error);
  }

  async function handleGenerateShoppingList() {
    if (!user) return;
    const result = await nutritionService.generateGroceryList(user.id);
    if (result.success) setGroceryList(result.data);
    else Alert.alert('Error', result.error);
  }

  async function handleMarkMeal(meal: Meal, status: 'completed' | 'modified' | 'skipped') {
    await nutritionService.markMealStatus(meal.id, meal.name, meal.instructions, status);
    load();
  }

  async function handleReplaceMeal(newName: string) {
    if (!replaceMeal) return;
    const templateIngredients = ingredientsForMealName(newName);
    const meta = enrichMealMeta(replaceMeal.name, replaceMeal.instructions);
    meta.status = 'modified';
    meta.ingredients = templateIngredients;
    await nutritionService.updateMeal(replaceMeal.id, {
      name: newName,
      instructions: serializeMealMeta(meta),
    });
    load();
  }

  async function handleReplaceIngredient(ingredientName: string, replacement: string) {
    if (!replaceMeal) return;
    const meta = enrichMealMeta(replaceMeal.name, replaceMeal.instructions);
    meta.ingredients = (meta.ingredients ?? []).map((item) =>
      item.name === ingredientName ? { name: replacement, serving: item.serving } : item,
    );
    meta.status = 'modified';
    await nutritionService.updateMeal(replaceMeal.id, { instructions: serializeMealMeta(meta) });
    load();
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={LiftFlowColors.accent} />
      </View>
    );
  }

  return (
    <ScreenContainer contentContainerStyle={styles.content}>
      <AppText variant="headline">Nutrition</AppText>
      <AppText variant="footnote" color="textSecondary">
        Wake ~4:00 AM · Workout ~{schedule.workoutHour ?? 9}:00 · Sleep ~{schedule.sleepHour ?? 21}:00
      </AppText>

      <NutritionSectionTabs active={section} onChange={setSection} />

      {section === 'today' ? (
        <>
          <NutritionProgressHeader
            summary={summary}
            goals={goals}
            mealsCompleted={mealsCompleted}
            mealsTotal={todayMeals.length}
          />
          <AppText variant="label" color="accent">
            Today&apos;s Plan
          </AppText>
          {todayMeals.length === 0 ? (
            <Card style={styles.empty}>
              <AppText variant="body" color="textSecondary">
                No meals scheduled for today.
              </AppText>
              <PrimaryButton label="Generate Weekly Meal Plan" onPress={ensureMealPlan} />
            </Card>
          ) : (
            todayMeals.map((meal, index) => (
              <MealPlanCard
                key={meal.id}
                meal={meal}
                scheduledTime={todayTimes[index]}
                onMarkComplete={(status) => handleMarkMeal(meal, status)}
                onReplace={() => {
                  setReplaceMeal(meal);
                  setReplaceMode('meal');
                }}
                onOpenDetail={() => setDetailMeal(meal)}
              />
            ))
          )}
        </>
      ) : null}

      {section === 'week' ? (
        <>
          {weekMeals.length === 0 ? (
            <PrimaryButton label="Generate Weekly Meal Plan" onPress={ensureMealPlan} />
          ) : (
            weekDays.map((day) => (
              <Card key={day.date} style={styles.dayCard}>
                <Pressable onPress={() => setExpandedDay(expandedDay === day.date ? null : day.date)} style={styles.dayHeader}>
                  <AppText variant="bodyBold">{day.label}</AppText>
                  <AppText variant="caption" color="textSecondary">
                    {day.meals.length} meals
                  </AppText>
                </Pressable>
                {expandedDay === day.date
                  ? day.meals.map((meal, index) => {
                      const times = scheduledTimesForDay(day.meals.map((m) => m.mealType), schedule, day.date === today && hasWorkoutToday);
                      return (
                        <View key={meal.id} style={styles.weekMealRow}>
                          <AppText variant="footnote" color="accent">
                            {times[index]}
                          </AppText>
                          <AppText variant="body">{meal.name}</AppText>
                          <AppText variant="caption" color="textSecondary">
                            {meal.calories ?? 0} cal · {Math.round(meal.proteinG ?? 0)}P
                          </AppText>
                        </View>
                      );
                    })
                  : null}
              </Card>
            ))
          )}
        </>
      ) : null}

      {section === 'shopping' ? (
        <>
          <PrimaryButton label="Generate Shopping List" variant="secondary" onPress={handleGenerateShoppingList} />
          <Card style={styles.shoppingCard}>
            {shoppingItems.length === 0 ? (
              <AppText variant="body" color="textSecondary">
                Generate a meal plan first.
              </AppText>
            ) : (
              shoppingItems.map((item) => (
                <View key={item.id} style={styles.shoppingRow}>
                  <AppText variant="bodyBold">{item.name}</AppText>
                  <AppText variant="footnote" color="textSecondary">
                    {item.quantity} {item.unit}
                  </AppText>
                </View>
              ))
            )}
          </Card>
        </>
      ) : null}

      <Pressable onPress={() => router.push('/(features)/nutrition-intelligence')} style={styles.fallback}>
        <AppText variant="caption" color="textTertiary">
          Advanced nutrition intelligence
        </AppText>
      </Pressable>

      <MealReplaceSheet
        visible={replaceMeal !== null}
        meal={replaceMeal}
        scheduledTime={todayTimes[todayMeals.findIndex((m) => m.id === replaceMeal?.id)]}
        mode={replaceMode}
        onClose={() => setReplaceMeal(null)}
        onReplaceMeal={handleReplaceMeal}
        onReplaceIngredient={handleReplaceIngredient}
      />

      {detailMeal ? (
        <MealReplaceSheet
          visible
          meal={detailMeal}
          scheduledTime={todayTimes[todayMeals.findIndex((m) => m.id === detailMeal.id)]}
          mode="meal"
          onClose={() => setDetailMeal(null)}
          onReplaceMeal={async (name) => {
            setReplaceMeal(detailMeal);
            await handleReplaceMeal(name);
            setDetailMeal(null);
          }}
          onReplaceIngredient={handleReplaceIngredient}
        />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LiftFlowColors.background,
  },
  content: {
    gap: Spacing.lg,
    paddingBottom: Spacing.huge,
  },
  empty: {
    gap: Spacing.md,
  },
  dayCard: {
    gap: Spacing.sm,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weekMealRow: {
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LiftFlowColors.border,
  },
  shoppingCard: {
    gap: Spacing.sm,
  },
  shoppingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LiftFlowColors.border,
  },
  fallback: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
});
