import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SkeletonBlock } from '@/components/layout/SkeletonBlock';
import { ErrorStateCard } from '@/components/layout/StateCard';
import { MealDetailSheet } from '@/components/nutrition/MealDetailSheet';
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
import { aggregateDailyMeals, aggregateWeeklyMeals, buildDailySummaryFromMeals, mealsForCalendarDay } from '@/lib/mealAggregation';
import {
    enrichMealMeta,
    serializeMealMeta,
} from '@/lib/mealIngredients';
import {
    buildSmartReplacementUpdate,
    selectMealsForScope,
} from '@/lib/mealReplacement';
import { formatScheduleSubtitle, scheduleFromProfile, scheduledTimesForDay } from '@/lib/mealSchedule';
import { resolveTimeZone } from '@/lib/localDate';
import { planDataCache } from '@/lib/planDataCache';
import { warmWeekPlanData } from '@/lib/planDataPrefetch';
import { logStartup } from '@/lib/startupLogger';
import { WEEKDAY_LABELS, getWeekRange } from '@/lib/weekPlan';
import { withTimeout } from '@/lib/withTimeout';
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
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [replaceMeal, setReplaceMeal] = useState<Meal | null>(null);
  const [replaceMode, setReplaceMode] = useState<'meal' | 'ingredient'>('meal');
  const [replaceIngredientName, setReplaceIngredientName] = useState<string | null>(null);
  const [detailMeal, setDetailMeal] = useState<Meal | null>(null);
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [hasWorkoutToday, setHasWorkoutToday] = useState(false);
  const [recoverySleepHours, setRecoverySleepHours] = useState<number | undefined>();
  const loadGenerationRef = useRef(0);
  const hydratedFromCacheRef = useRef(false);
  const skipFocusLoadRef = useRef(true);

  const today = useLocalCalendarDay(user?.timezone);
  const weekRange = useMemo(() => getWeekRange(new Date(), user?.timezone), [user?.timezone, today]);
  const schedule = scheduleFromProfile(user, hasWorkoutToday, recoverySleepHours);
  const dietaryRestrictions = user?.metadata?.coachProfile?.dietaryRestrictions ?? [];

  function applyWorkoutTodayFromPlan(planned: Parameters<typeof resolveActiveTrainingDay>[0]) {
    const activeDay = resolveActiveTrainingDay(planned, { date: today, timeZone: user?.timezone });
    setHasWorkoutToday(!activeDay.isScheduledRestDay);
  }

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!user) {
      setLoading(false);
      return;
    }

    const generation = ++loadGenerationRef.current;
    const hasCachedData = weekMeals.length > 0 || goals != null || hydratedFromCacheRef.current;
    const silent = options?.silent ?? hasCachedData;

    if (!silent) setLoading(true);
    setLoadError(null);

    const { from, to } = getWeekRange(new Date(), user.timezone);

    try {
      const [goalsRes, weekRes] = await Promise.all([
        withTimeout(nutritionService.getGoals(user.id), 8_000, 'nutrition goals'),
        withTimeout(nutritionService.getMealsForWeek(user.id, from, to), 8_000, 'week meals'),
      ]);

      if (generation !== loadGenerationRef.current) return;

      const errors: string[] = [];
      if (!goalsRes.success) errors.push(goalsRes.error);
      setLoadError(errors[0] ?? null);

      const nextGoals = goalsRes.success ? goalsRes.data : goals;
      const nextWeekMeals = weekRes.success ? weekRes.data : weekMeals;

      if (goalsRes.success) {
        setGoals(goalsRes.data);
        void planDataCache.writeGoals(user.id, goalsRes.data);
      }
      if (weekRes.success) {
        setWeekMeals(weekRes.data);
        void planDataCache.writeMeals(user.id, from, to, weekRes.data);
        logStartup('NUTRITION_PLAN_LOADED', { count: weekRes.data.length, source: 'nutrition-tab' });
      }

      setSummary((prev) =>
        buildDailySummaryFromMeals(nextWeekMeals, today, nextGoals, prev?.waterMl ?? 0),
      );
    } catch (error) {
      console.warn('[nutrition] critical load failed', error);
      if (generation === loadGenerationRef.current) {
        setLoadError('Could not refresh nutrition data. Pull to retry.');
      }
    } finally {
      if (generation === loadGenerationRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }

    void (async () => {
      try {
        const summaryRes = await withTimeout(
          nutritionService.getDailySummary(user.id, today),
          6_000,
          'hydration summary',
        );
        if (generation !== loadGenerationRef.current || !summaryRes.success) return;
        setSummary((prev) =>
          prev
            ? { ...prev, waterMl: summaryRes.data.waterMl, waterTargetMl: summaryRes.data.waterTargetMl }
            : summaryRes.data,
        );
      } catch {
        // water tracking is non-critical for first paint
      }
    })();

    void (async () => {
      try {
        const cached = await planDataCache.readWeek(user.id, from, to);
        if (cached.workouts.length > 0) {
          if (generation === loadGenerationRef.current) applyWorkoutTodayFromPlan(cached.workouts);
          return;
        }

        const plannedRes = await withTimeout(
          trainingService.getPlannedWorkouts(user.id, from, to, user.timezone),
          8_000,
          'workout plan for nutrition',
        );
        if (generation !== loadGenerationRef.current) return;
        if (plannedRes.success) applyWorkoutTodayFromPlan(plannedRes.data);
      } catch {
        // schedule defaults are fine without workout context
      }
    })();

    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token || generation !== loadGenerationRef.current) return;
        const recoveryToday = await withTimeout(
          api.getRecoveryToday(user.id, token),
          6_000,
          'recovery today',
        ).catch(() => null);
        if (generation !== loadGenerationRef.current) return;
        const sleepHours = recoveryToday?.sleepHours;
        if (typeof sleepHours === 'number') setRecoverySleepHours(sleepHours);
      } catch {
        // optional context
      }
    })();

    void (async () => {
      try {
        const groceryRes = await nutritionService.getGroceryLists(user.id);
        if (generation !== loadGenerationRef.current) return;
        if (weekMeals.length > 0) {
          const synced = await nutritionService.syncGroceryListFromMeals(user.id, from, to);
          if (generation !== loadGenerationRef.current) return;
          if (synced.success && synced.data) setGroceryList(synced.data);
        } else if (groceryRes.success && groceryRes.data?.[0]) {
          setGroceryList(groceryRes.data[0]);
        }
      } catch {
        // shopping list is non-critical
      }
    })();

    void (async () => {
      try {
        await nutritionService.pruneDuplicateMeals(user.id, { from, to });
        if (generation !== loadGenerationRef.current) return;
        await nutritionService.ensureWeekMealCoverage(user.id, user.timezone);
        if (generation !== loadGenerationRef.current) return;
        const refreshed = await nutritionService.getMealsForWeek(user.id, from, to);
        if (generation !== loadGenerationRef.current || !refreshed.success) return;
        if (refreshed.data.length > 0) {
          setWeekMeals(refreshed.data);
          void planDataCache.writeMeals(user.id, from, to, refreshed.data);
          setSummary((prev) =>
            buildDailySummaryFromMeals(refreshed.data, today, goals, prev?.waterMl ?? 0),
          );
        }
      } catch {
        // day sync is best-effort; explicit generate still available
      }
    })();
  }, [user, today, weekMeals.length, goals]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load({ silent: true });
    setRefreshing(false);
  }, [load]);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;
    const { from, to } = getWeekRange(new Date(), user.timezone);

    void (async () => {
      const cached = await planDataCache.readWeek(user.id, from, to);
      if (cancelled) return;

      if (cached.goals) setGoals(cached.goals);
      if (cached.workouts.length > 0) applyWorkoutTodayFromPlan(cached.workouts);
      if (cached.meals.length > 0) setWeekMeals(cached.meals);

      if (cached.goals || cached.meals.length > 0) {
        setSummary(buildDailySummaryFromMeals(cached.meals, today, cached.goals));
        setLoading(false);
        hydratedFromCacheRef.current = true;
      }

      void warmWeekPlanData(user.id, user.timezone);
      void load({ silent: hydratedFromCacheRef.current });
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.timezone, load]);

  useFocusEffect(
    useCallback(() => {
      if (skipFocusLoadRef.current) {
        skipFocusLoadRef.current = false;
        return;
      }
      if (user) void load({ silent: true });
    }, [user, load]),
  );

  useAppResume(() => {
    if (user) void load({ silent: true });
  });

  useLocalWeekRollover(user?.timezone, () => {
    if (!user) return;
    void nutritionService.ensureWeekMealCoverage(user.id, user.timezone).then(() => {
      void load({ silent: true });
    });
  });

  useEffect(() => {
    if (revision > 0 && user) void load({ silent: true });
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
    const generation = ++loadGenerationRef.current;
    const tz = resolveTimeZone(user.timezone);
    setLoading(true);
    try {
      const result = await nutritionService.generateWeeklyMealPlan(user.id, tz);
      if (generation !== loadGenerationRef.current) return;

      if (!result.success) {
        Alert.alert('Could not generate meal plan', result.error);
        return;
      }

      const { from, to } = getWeekRange(new Date(), tz);
      const meals = result.data.meals ?? [];
      if (meals.length === 0) {
        Alert.alert('Could not generate meal plan', 'No meals were saved. Pull to refresh and try again.');
        return;
      }

      setWeekMeals(meals);
      setSummary((prev) => buildDailySummaryFromMeals(meals, today, goals, prev?.waterMl ?? 0));
      void planDataCache.writeMeals(user.id, from, to, meals);
      setLoadError(null);
      setSection('today');
    } finally {
      if (generation === loadGenerationRef.current) {
        setLoading(false);
      }
    }
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

  if (loading && !refreshing && weekMeals.length === 0 && goals == null) {
    return (
      <ScreenContainer contentContainerStyle={styles.content}>
        <SkeletonBlock height={28} width="40%" />
        <SkeletonBlock height={14} width="60%" />
        <SkeletonBlock height={120} />
        <SkeletonBlock height={160} />
        <SkeletonBlock height={160} />
      </ScreenContainer>
    );
  }

  if (loadError && !goals && !summary) {
    return (
      <ScreenContainer contentContainerStyle={styles.errorContent}>
        <ErrorStateCard
          title="Nutrition unavailable"
          message={loadError}
          onRetry={() => void load()}
          onBack={() => router.replace('/(tabs)/dashboard')}
          backLabel="Back to Home"
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={LiftFlowColors.accent} />
      }>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <AppText variant="headline">Nutrition</AppText>
          <AppText variant="footnote" color="textSecondary">
            {formatScheduleSubtitle(schedule)}
          </AppText>
        </View>
        <Pressable onPress={() => router.push('/(features)/nutrition-preferences')} hitSlop={8}>
          <AppText variant="caption" color="accent">
            Preferences
          </AppText>
        </Pressable>
      </View>

      <Pressable onPress={() => router.push('/(features)/nutrition-intelligence')}>
        <Card glow style={styles.intelCard}>
          <AppText variant="label" color="accent">
            Nutrition Intelligence
          </AppText>
          <AppText variant="footnote" color="textSecondary">
            Personalized insights from your logs, plan, and recovery
          </AppText>
        </Card>
      </Pressable>

      {loadError ? (
        <Card style={styles.loadWarning}>
          <AppText variant="footnote" color="textSecondary">
            Some nutrition data could not be refreshed: {loadError}
          </AppText>
          <Pressable onPress={() => void load()}>
            <AppText variant="caption" color="accent">
              Retry
            </AppText>
          </Pressable>
        </Card>
      ) : null}

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

      <MealDetailSheet
        visible={detailMeal !== null}
        meal={detailMeal}
        scheduledTime={detailMeal ? todayTimes[todayMeals.findIndex((m) => m.id === detailMeal.id)] : undefined}
        onClose={() => setDetailMeal(null)}
        onReplace={
          detailMeal
            ? () => {
                setReplaceMeal(detailMeal);
                setReplaceMode('meal');
                setReplaceIngredientName(null);
                setDetailMeal(null);
              }
            : undefined
        }
        onMarkComplete={(status) => {
          if (detailMeal) void handleMarkMeal(detailMeal, status);
          setDetailMeal(null);
        }}
      />

      <QuickMealLogSheet
        visible={quickLogOpen}
        onClose={() => setQuickLogOpen(false)}
        onSubmit={handleQuickLogMeal}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.lg,
    paddingBottom: Spacing.huge,
  },
  errorContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  headerText: {
    flex: 1,
    gap: Spacing.xs,
  },
  intelCard: {
    gap: Spacing.xs,
  },
  loadWarning: {
    gap: Spacing.sm,
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
});
