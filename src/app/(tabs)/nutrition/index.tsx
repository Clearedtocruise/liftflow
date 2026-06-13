import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { MealPlanCard } from '@/components/nutrition/MealPlanCard';
import { MealReplaceSheet, type SmartReplacementPayload } from '@/components/nutrition/MealReplaceSheet';
import { NutritionProgressHeader } from '@/components/nutrition/NutritionProgressHeader';
import { NutritionSectionTabs, type NutritionSection } from '@/components/nutrition/NutritionSectionTabs';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { aggregateWeeklyGroceries, groupGroceriesByCategory } from '@/lib/groceryAggregation';
import { localDateString } from '@/lib/localDate';
import { aggregateDailyMeals, aggregateWeeklyMeals, dedupeMealsByType } from '@/lib/mealAggregation';
import {
  enrichMealMeta,
  serializeMealMeta,
} from '@/lib/mealIngredients';
import {
  buildSmartReplacementUpdate,
  selectMealsForScope,
} from '@/lib/mealReplacement';
import { formatScheduleSubtitle, scheduleFromProfile, scheduledTimesForDay } from '@/lib/mealSchedule';
import { WEEKDAY_LABELS, getWeekRange } from '@/lib/weekPlan';
import type { MealAlternativeOption } from '@/services/nutritionAdvisoryService';
import { nutritionService } from '@/services/nutritionService';
import { trainingService } from '@/services/trainingService';
import { getAccessToken } from '@/supabase/client';
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
  const [replaceIngredientName, setReplaceIngredientName] = useState<string | null>(null);
  const [detailMeal, setDetailMeal] = useState<Meal | null>(null);
  const [hasWorkoutToday, setHasWorkoutToday] = useState(false);
  const [recoverySleepHours, setRecoverySleepHours] = useState<number | undefined>();

  const today = useMemo(() => localDateString(new Date(), user?.timezone), [user?.timezone]);
  const schedule = scheduleFromProfile(user, hasWorkoutToday, recoverySleepHours);
  const dietaryRestrictions = user?.metadata?.coachProfile?.dietaryRestrictions ?? [];

  const load = useCallback(async () => {
    if (!user) return;
    const { from, to } = getWeekRange();
    await nutritionService.pruneDuplicateMeals(user.id, { from, to });

    const token = await getAccessToken();
    const recoveryPromise = token
      ? api.getRecoveryToday(user.id, token).catch(() => null)
      : Promise.resolve(null);

    const [goalsRes, summaryRes, weekRes, dashRes, recoveryToday, groceryRes] = await Promise.all([
      nutritionService.getGoals(user.id),
      nutritionService.getDailySummary(user.id, today),
      nutritionService.getMealsForWeek(user.id, from, to),
      trainingService.getDashboard(user.id),
      recoveryPromise,
      nutritionService.getGroceryLists(user.id),
    ]);

    if (goalsRes.success) setGoals(goalsRes.data);
    if (summaryRes.success) setSummary(summaryRes.data);
    if (weekRes.success) setWeekMeals(weekRes.data);
    if (groceryRes.success && groceryRes.data?.[0]) setGroceryList(groceryRes.data[0]);
    if (dashRes.success) {
      setHasWorkoutToday(dashRes.data.nextWorkout?.scheduledDate === today);
    }

    const sleepHours = recoveryToday?.sleepHours;
    setRecoverySleepHours(typeof sleepHours === 'number' ? sleepHours : undefined);
    setLoading(false);
  }, [user, today]);

  useEffect(() => {
    load();
  }, [load]);

  const todayMeals = useMemo(
    () => dedupeMealsByType(weekMeals.filter((meal) => meal.scheduledDate === today)),
    [weekMeals, today],
  );
  const todayTimes = useMemo(
    () => scheduledTimesForDay(todayMeals.map((meal) => meal.mealType), schedule, hasWorkoutToday),
    [todayMeals, schedule, hasWorkoutToday],
  );

  const mealAggregation = useMemo(
    () => aggregateDailyMeals(weekMeals.filter((m) => m.scheduledDate === today)),
    [weekMeals, today],
  );

  const weekDays = useMemo(() => {
    const { dates } = getWeekRange();
    return dates.map((date, index) => ({
      date,
      label: WEEKDAY_LABELS[index],
      meals: dedupeMealsByType(weekMeals.filter((meal) => meal.scheduledDate === date)),
    }));
  }, [weekMeals]);

  const weekAggregation = useMemo(() => aggregateWeeklyMeals(weekMeals), [weekMeals]);

  const shoppingItems = useMemo(() => {
    if (groceryList?.items?.length) {
      return groceryList.items.map((item) => ({
        name: item.name,
        quantity: `${item.quantity} ${item.unit}`.trim(),
        category: item.category ?? 'Pantry',
      }));
    }
    return aggregateWeeklyGroceries(weekMeals);
  }, [groceryList, weekMeals]);

  const groupedShopping = useMemo(() => groupGroceriesByCategory(shoppingItems), [shoppingItems]);

  async function syncGroceriesAfterReplace() {
    if (!user) return;
    const { from, to } = getWeekRange(undefined, user.timezone);
    const grocerySync = await nutritionService.syncGroceryListFromMeals(user.id, from, to);
    if (grocerySync.success && grocerySync.data) {
      setGroceryList(grocerySync.data);
    }
  }

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

  async function handleReplaceMeal(meal: Meal, option: MealAlternativeOption) {
    const meta = enrichMealMeta(meal.name, meal.instructions);
    meta.status = 'modified';
    meta.ingredients = option.ingredients;
    const result = await nutritionService.updateMeal(meal.id, {
      name: option.name,
      calories: option.calories,
      proteinG: option.proteinG,
      carbsG: option.carbsG,
      fatG: option.fatG,
      instructions: serializeMealMeta(meta),
    });
    if (!result.success) {
      Alert.alert('Error', result.error);
      return;
    }
    setReplaceMeal(null);
    await syncGroceriesAfterReplace();
    load();
  }

  async function handleReplaceIngredient(ingredientName: string, replacement: string) {
    if (!replaceMeal) return;
    const meta = enrichMealMeta(replaceMeal.name, replaceMeal.instructions);
    meta.ingredients = (meta.ingredients ?? []).map((item) =>
      item.name === ingredientName ? { name: replacement, serving: item.serving } : item,
    );
    meta.status = 'modified';
    const result = await nutritionService.updateMeal(replaceMeal.id, { instructions: serializeMealMeta(meta) });
    if (!result.success) {
      Alert.alert('Error', result.error);
      return;
    }
    setReplaceMeal(null);
    await syncGroceriesAfterReplace();
    load();
  }

  async function handleSmartReplace(anchorMeal: Meal, payload: SmartReplacementPayload) {
    if (!user) return;
    const { from, to } = getWeekRange(undefined, user.timezone);
    const targets = selectMealsForScope(
      anchorMeal,
      weekMeals,
      payload.scope,
      replaceMode === 'ingredient' ? replaceIngredientName ?? undefined : undefined,
    );

    for (const target of targets) {
      const updates = buildSmartReplacementUpdate(
        target,
        replaceMode,
        replaceIngredientName ?? undefined,
        {
          foodName: payload.foodName,
          servingSize: payload.servingSize,
          macros: payload.macros,
        },
      );
      const result = await nutritionService.updateMeal(target.id, updates);
      if (!result.success) {
        Alert.alert('Error', result.error);
        return;
      }
    }

    await syncGroceriesAfterReplace();
    setReplaceMeal(null);
    setReplaceIngredientName(null);
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
        {formatScheduleSubtitle(schedule)}
      </AppText>

      <NutritionSectionTabs active={section} onChange={setSection} />

      {section === 'today' ? (
        <>
          <NutritionProgressHeader
            summary={summary}
            goals={goals}
            mealsCompleted={mealAggregation.mealsCompleted}
            mealsTotal={mealAggregation.mealsTotal}
            caloriesConsumed={mealAggregation.caloriesConsumed}
            proteinG={mealAggregation.proteinG}
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
                  setReplaceIngredientName(null);
                }}
                onReplaceIngredient={(ingredientName) => {
                  setReplaceMeal(meal);
                  setReplaceMode('ingredient');
                  setReplaceIngredientName(ingredientName);
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
            <>
              <Card style={styles.weekSummary}>
                <AppText variant="label" color="accent">
                  Week totals
                </AppText>
                <AppText variant="body" color="textSecondary">
                  {weekAggregation.caloriesConsumed} / {weekAggregation.plannedCalories} cal consumed ·{' '}
                  {Math.round(weekAggregation.proteinG)} / {Math.round(weekAggregation.plannedProteinG)}g protein ·{' '}
                  {weekAggregation.mealsCompleted} / {weekAggregation.mealsTotal} meals logged
                </AppText>
              </Card>
              {weekDays.map((day) => (
              <Card key={day.date} style={styles.dayCard}>
                <Pressable onPress={() => setExpandedDay(expandedDay === day.date ? null : day.date)} style={styles.dayHeader}>
                  <AppText variant="bodyBold">{day.label}</AppText>
                  <AppText variant="caption" color="textSecondary">
                    {day.meals.length} meals
                  </AppText>
                </Pressable>
                {expandedDay === day.date
                  ? day.meals.map((meal, index) => {
                      const times = scheduledTimesForDay(
                        day.meals.map((m) => m.mealType),
                        schedule,
                        day.date === today && hasWorkoutToday,
                      );
                      return (
                        <View key={meal.id} style={styles.weekMealRow}>
                          <AppText variant="footnote" color="accent">
                            {times[index]}
                          </AppText>
                          <AppText variant="body">{meal.name}</AppText>
                          <AppText variant="caption" color="textSecondary">
                            {meal.calories ?? 0} cal · {Math.round(meal.proteinG ?? 0)}P · {Math.round(meal.carbsG ?? 0)}C ·{' '}
                            {Math.round(meal.fatG ?? 0)}F
                          </AppText>
                        </View>
                      );
                    })
                  : null}
              </Card>
              ))}
            </>
          )}
        </>
      ) : null}

      {section === 'shopping' ? (
        <>
          <PrimaryButton label="Generate Shopping List" variant="secondary" onPress={handleGenerateShoppingList} />
          {shoppingItems.length === 0 ? (
            <Card style={styles.shoppingCard}>
              <AppText variant="body" color="textSecondary">
                Generate a meal plan first.
              </AppText>
            </Card>
          ) : (
            Object.entries(groupedShopping).map(([category, items]) => (
              <Card key={category} style={styles.shoppingCard}>
                <AppText variant="label" color="accent">
                  {category}
                </AppText>
                {items.map((item) => (
                  <View key={`${category}-${item.name}`} style={styles.shoppingRow}>
                    <AppText variant="bodyBold">{item.name}</AppText>
                    <AppText variant="footnote" color="textSecondary">
                      {item.quantity}
                    </AppText>
                  </View>
                ))}
              </Card>
            ))
          )}
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
        ingredientName={replaceIngredientName ?? undefined}
        dietaryRestrictions={dietaryRestrictions}
        onClose={() => {
          setReplaceMeal(null);
          setReplaceIngredientName(null);
        }}
        onReplaceMeal={(option) => {
          if (replaceMeal) void handleReplaceMeal(replaceMeal, option);
        }}
        onReplaceIngredient={handleReplaceIngredient}
        onSmartReplace={(payload) => {
          if (replaceMeal) void handleSmartReplace(replaceMeal, payload);
        }}
      />

      {detailMeal ? (
        <MealReplaceSheet
          visible
          meal={detailMeal}
          scheduledTime={todayTimes[todayMeals.findIndex((m) => m.id === detailMeal.id)]}
          mode="meal"
          dietaryRestrictions={dietaryRestrictions}
          onClose={() => setDetailMeal(null)}
          onReplaceMeal={(option) => {
            void handleReplaceMeal(detailMeal, option);
            setDetailMeal(null);
          }}
          onReplaceIngredient={handleReplaceIngredient}
          onSmartReplace={(payload) => {
            void handleSmartReplace(detailMeal, payload);
            setDetailMeal(null);
          }}
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
  weekSummary: {
    gap: Spacing.xs,
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
