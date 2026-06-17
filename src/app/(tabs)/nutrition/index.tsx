import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
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
import { QuickMealLogSheet } from '@/components/nutrition/QuickMealLogSheet';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { usePlanAdjustment } from '@/contexts/PlanAdjustmentContext';
import { useAppResume } from '@/hooks/useAppResume';
import { useAuth } from '@/hooks/useAuth';
import { useLocalCalendarDay } from '@/hooks/useLocalCalendarDay';
import { useLocalWeekRollover } from '@/hooks/useLocalWeekRollover';
import { resolveActiveTrainingDay } from '@/lib/activeTrainingDay';
import { aggregateWeeklyGroceries, groupGroceriesByCategory } from '@/lib/groceryAggregation';
import { aggregateDailyMeals, aggregateWeeklyMeals, mealsForCalendarDay } from '@/lib/mealAggregation';
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
import type { MealType } from '@/types/common';

export default function NutritionScreen() {
  const { user } = useAuth();
  const { log } = useLocalSearchParams<{ log?: string }>();
  const { revision } = usePlanAdjustment();
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
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [hasWorkoutToday, setHasWorkoutToday] = useState(false);
  const [recoverySleepHours, setRecoverySleepHours] = useState<number | undefined>();

  const today = useLocalCalendarDay(user?.timezone);
  const weekRange = useMemo(() => getWeekRange(new Date(), user?.timezone), [user?.timezone, today]);
  const schedule = scheduleFromProfile(user, hasWorkoutToday, recoverySleepHours);
  const dietaryRestrictions = user?.metadata?.coachProfile?.dietaryRestrictions ?? [];

  const load = useCallback(async () => {
    if (!user) return;
    const { from, to } = getWeekRange(new Date(), user.timezone);
    await nutritionService.pruneDuplicateMeals(user.id, { from, to });
    await nutritionService.ensureWeekMealCoverage(user.id, user.timezone);

    const token = await getAccessToken();
    const recoveryPromise = token
      ? api.getRecoveryToday(user.id, token).catch(() => null)
      : Promise.resolve(null);

    const [goalsRes, summaryRes, weekRes, plannedRes, recoveryToday, groceryRes] = await Promise.all([
      nutritionService.getGoals(user.id),
      nutritionService.getDailySummary(user.id, today),
      nutritionService.getMealsForWeek(user.id, from, to),
      trainingService.getPlannedWorkouts(user.id, from, to, user.timezone),
      recoveryPromise,
      nutritionService.getGroceryLists(user.id),
    ]);

    if (goalsRes.success) setGoals(goalsRes.data);
    if (summaryRes.success) setSummary(summaryRes.data);
    if (weekRes.success) setWeekMeals(weekRes.data);
    if (weekRes.success && weekRes.data.length > 0) {
      const synced = await nutritionService.syncGroceryListFromMeals(user.id, from, to);
      if (synced.success && synced.data) setGroceryList(synced.data);
    } else if (groceryRes.success && groceryRes.data?.[0]) {
      setGroceryList(groceryRes.data[0]);
    }

    const planned = plannedRes.success ? plannedRes.data : [];
    const activeDay = resolveActiveTrainingDay(planned, { date: today, timeZone: user.timezone });
    setHasWorkoutToday(!activeDay.isScheduledRestDay);

    const sleepHours = recoveryToday?.sleepHours;
    setRecoverySleepHours(typeof sleepHours === 'number' ? sleepHours : undefined);
    setLoading(false);
  }, [user, today]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (user) void load();
    }, [user, load]),
  );

  useAppResume(() => {
    if (user) void load();
  });

  useLocalWeekRollover(user?.timezone, () => {
    if (user) void load();
  });

  useEffect(() => {
    if (revision > 0 && user) void load();
  }, [revision, user, load]);

  const todayMeals = useMemo(() => mealsForCalendarDay(weekMeals, today), [weekMeals, today]);
  const todayTimes = useMemo(
    () => scheduledTimesForDay(todayMeals.map((meal) => meal.mealType), schedule, hasWorkoutToday),
    [todayMeals, schedule, hasWorkoutToday],
  );

  const mealAggregation = useMemo(
    () => aggregateDailyMeals(mealsForCalendarDay(weekMeals, today)),
    [weekMeals, today],
  );

  const weekDays = useMemo(() => {
    return weekRange.dates.map((date, index) => ({
      date,
      label: WEEKDAY_LABELS[index],
      isToday: date === today,
      meals: mealsForCalendarDay(weekMeals, date),
    }));
  }, [weekMeals, weekRange.dates, today]);

  const weekAggregation = useMemo(() => aggregateWeeklyMeals(weekMeals), [weekMeals]);

  const shoppingItems = useMemo(() => aggregateWeeklyGroceries(weekMeals), [weekMeals]);

  const groupedShopping = useMemo(() => groupGroceriesByCategory(shoppingItems), [shoppingItems]);

  useEffect(() => {
    if (log === '1') setQuickLogOpen(true);
  }, [log]);

  useEffect(() => {
    if (section !== 'week') return;
    setExpandedDay((current) => current ?? today);
  }, [section, today]);

  async function handleQuickLogMeal(payload: {
    name: string;
    mealType: MealType;
    calories?: number;
    proteinG?: number;
  }) {
    if (!user) return;
    const meta = enrichMealMeta(payload.name, undefined);
    meta.status = 'completed';
    const result = await nutritionService.logFood(user.id, {
      ...payload,
      date: today,
      instructions: serializeMealMeta(meta),
    });
    if (result.success) {
      await load();
    } else {
      Alert.alert('Could not log meal', result.error);
    }
  }

  async function syncGroceriesAfterReplace() {
    if (!user) return;
    const { from, to } = getWeekRange(new Date(), user.timezone);
    const grocerySync = await nutritionService.syncGroceryListFromMeals(user.id, from, to);
    if (grocerySync.success && grocerySync.data) {
      setGroceryList(grocerySync.data);
    }
  }

  async function ensureMealPlan() {
    if (!user) return;
    const { dates } = getWeekRange(new Date(), user.timezone);
    const hasFullWeek = dates.every((date) => mealsForCalendarDay(weekMeals, date).length > 0);
    if (hasFullWeek) return;
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
    const { from, to } = getWeekRange(new Date(), user.timezone);
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
          <View style={styles.todayHeader}>
            <AppText variant="label" color="accent">
              Today&apos;s Plan
            </AppText>
            <Pressable onPress={() => setQuickLogOpen(true)} hitSlop={8}>
              <AppText variant="caption" color="accent">
                + Log meal
              </AppText>
            </Pressable>
          </View>
          {todayMeals.length === 0 ? (
            <Card style={styles.empty}>
              <AppText variant="body" color="textSecondary">
                No meals scheduled for today. Log what you ate or generate a coached plan.
              </AppText>
              <PrimaryButton label="Log a Meal" onPress={() => setQuickLogOpen(true)} />
              <PrimaryButton label="Generate Weekly Meal Plan" variant="secondary" onPress={ensureMealPlan} />
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
                  <AppText variant="bodyBold">
                    {day.label}
                    {day.isToday ? ' · Today' : ''}
                  </AppText>
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
          <Card style={styles.weekSummary}>
            <AppText variant="label" color="accent">
              Weekly shopping
            </AppText>
            <AppText variant="body" color="textSecondary">
              {weekRange.from} – {weekRange.to} · {weekMeals.length} planned meals · {shoppingItems.length} items
            </AppText>
          </Card>
          <PrimaryButton label="Refresh Shopping List" variant="secondary" onPress={handleGenerateShoppingList} />
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

      <QuickMealLogSheet
        visible={quickLogOpen}
        onClose={() => setQuickLogOpen(false)}
        onSubmit={handleQuickLogMeal}
      />
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
  todayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
