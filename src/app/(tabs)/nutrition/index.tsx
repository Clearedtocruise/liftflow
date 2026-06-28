import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, InteractionManager, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import { HomePlanAdjustedBanner } from '@/components/dashboard/HomePlanAdjustedBanner';
import { Card } from '@/components/layout/Card';
import { HeroPhotoBanner } from '@/components/layout/HeroPhotoBanner';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { SkeletonBlock } from '@/components/layout/SkeletonBlock';
import { ErrorStateCard } from '@/components/layout/StateCard';
import { MealDetailSheet } from '@/components/nutrition/MealDetailSheet';
import { MealPlanCard } from '@/components/nutrition/MealPlanCard';
import { MealReplaceSheet, type SmartReplacementPayload } from '@/components/nutrition/MealReplaceSheet';
import { NutritionMetricsRow } from '@/components/nutrition/NutritionMetricsRow';
import { NutritionProgressHeader } from '@/components/nutrition/NutritionProgressHeader';
import { NutritionSectionTabs, type NutritionSection } from '@/components/nutrition/NutritionSectionTabs';
import { QuickMealLogSheet } from '@/components/nutrition/QuickMealLogSheet';
import { FeatureGate } from '@/components/subscription/PremiumGate';
import { AppText } from '@/components/ui/AppText';
import { HeroImages } from '@/constants/imagery';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { usePlanAdjustment } from '@/contexts/PlanAdjustmentContext';
import { useAppResume } from '@/hooks/useAppResume';
import { useAuth } from '@/hooks/useAuth';
import { useLocalCalendarDay } from '@/hooks/useLocalCalendarDay';
import { useLocalWeekRollover } from '@/hooks/useLocalWeekRollover';
import { resolveActiveTrainingDay } from '@/lib/activeTrainingDay';
import { aggregateWeeklyGroceries, groupGroceriesByCategory } from '@/lib/groceryAggregation';
import { resolveTimeZone } from '@/lib/localDate';
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
import { planDataCache } from '@/lib/planDataCache';
import { invalidateWeekPlanPrefetch, warmWeekPlanData } from '@/lib/planDataPrefetch';
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
  const { log, generate } = useLocalSearchParams<{ log?: string; generate?: string }>();
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
  const [generating, setGenerating] = useState(false);
  const loadGenerationRef = useRef(0);
  const generatingRef = useRef(false);
  const hydratedFromCacheRef = useRef(false);
  const skipFocusLoadRef = useRef(true);
  const generateHandledRef = useRef(false);

  const today = useLocalCalendarDay(user?.timezone);
  const weekRange = useMemo(() => getWeekRange(new Date(), user?.timezone), [user?.timezone, today]);
  const schedule = scheduleFromProfile(user, hasWorkoutToday, recoverySleepHours);
  const dietaryRestrictions = useMemo(
    () => user?.metadata?.coachProfile?.dietaryRestrictions ?? [],
    [user?.metadata?.coachProfile?.dietaryRestrictions],
  );

  function applyWorkoutTodayFromPlan(planned: Parameters<typeof resolveActiveTrainingDay>[0]) {
    const activeDay = resolveActiveTrainingDay(planned, { date: today, timeZone: user?.timezone });
    setHasWorkoutToday(!activeDay.isScheduledRestDay);
  }

  async function applySavedMeals(updatedMeals: Meal[]) {
    if (!user || updatedMeals.length === 0) return;
    const { from, to } = getWeekRange(new Date(), user.timezone);
    invalidateWeekPlanPrefetch(user.id, user.timezone);
    const merged = await planDataCache.patchMeals(user.id, from, to, updatedMeals);
    setWeekMeals(merged);
    setDetailMeal((current) => {
      if (!current) return current;
      return merged.find((meal) => meal.id === current.id) ?? current;
    });
    setSummary((prev) => buildDailySummaryFromMeals(merged, today, goals, prev?.waterMl ?? 0));
  }

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!user) {
      setLoading(false);
      return;
    }

    const generation = ++loadGenerationRef.current;
    const silent = options?.silent ?? hydratedFromCacheRef.current;

    if (!silent) setLoading(true);
    setLoadError(null);

    const { from, to } = getWeekRange(new Date(), user.timezone);

    try {
      const cached = await planDataCache.readWeek(user.id, from, to);
      if (generation !== loadGenerationRef.current) return;

      if (cached.goals) {
        setGoals(cached.goals);
      }
      if (cached.meals.length > 0) {
        setWeekMeals(cached.meals);
        logStartup('NUTRITION_PLAN_LOADED', { count: cached.meals.length, source: 'nutrition-tab' });
      }

      setSummary((prev) =>
        buildDailySummaryFromMeals(cached.meals, today, cached.goals, prev?.waterMl ?? 0),
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

    void withTimeout(warmWeekPlanData(user.id, user.timezone), 10_000, 'week plan warm')
      .catch(() => undefined)
      .then(async () => {
        if (generation !== loadGenerationRef.current) return;
        const fresh = await planDataCache.readWeek(user.id, from, to);
        if (generation !== loadGenerationRef.current) return;

        if (fresh.goals) setGoals(fresh.goals);
        if (fresh.meals.length > 0) {
          setWeekMeals(fresh.meals);
          logStartup('NUTRITION_PLAN_LOADED', { count: fresh.meals.length, source: 'nutrition-tab-refresh' });
        }
        setSummary((prev) =>
          buildDailySummaryFromMeals(fresh.meals, today, fresh.goals, prev?.waterMl ?? 0),
        );
      });

    InteractionManager.runAfterInteractions(() => {
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
          const mealCount = weekMeals.length;
          if (mealCount > 0) {
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
    });
  }, [user?.id, user?.timezone, today]);

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

      if (hydratedFromCacheRef.current) {
        InteractionManager.runAfterInteractions(() => {
          void load({ silent: true });
        });
      } else {
        void warmWeekPlanData(user.id, user.timezone);
        void load({ silent: false });
      }
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
    if (generate !== '1' || !user?.id || generateHandledRef.current || generatingRef.current) return;
    generateHandledRef.current = true;
    void ensureMealPlan();
  }, [generate, user?.id]);

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
    if (!user || generatingRef.current) return;
    generatingRef.current = true;
    setGenerating(true);
    setLoadError(null);

    const tz = resolveTimeZone(user.timezone);
    const { from, to } = getWeekRange(new Date(), user.timezone);

    try {
      const result = await nutritionService.generateWeeklyMealPlan(user.id, tz);

      if (!result.success) {
        Alert.alert('Could not generate meal plan', result.error);
        return;
      }

      const meals = result.data.meals ?? [];
      if (meals.length === 0) {
        Alert.alert('Could not generate meal plan', 'No meals were saved. Pull to refresh and try again.');
        return;
      }

      loadGenerationRef.current += 1;
      setWeekMeals(meals);
      setSummary((prev) => buildDailySummaryFromMeals(meals, today, goals, prev?.waterMl ?? 0));
      void planDataCache.writeMeals(user.id, from, to, meals);
      setLoadError(null);
      setSection('today');

      void nutritionService.syncGroceryListFromMeals(user.id, from, to).then((synced) => {
        if (synced.success && synced.data) setGroceryList(synced.data);
      });
    } finally {
      generatingRef.current = false;
      setGenerating(false);
      setLoading(false);
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
    setReplaceMeal(null);
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
    void syncGroceriesAfterReplace();
    await applySavedMeals([result.data]);
  }

  async function handleReplaceIngredient(ingredientName: string, replacement: string) {
    if (!replaceMeal) return;
    const meal = replaceMeal;
    setReplaceMeal(null);
    const meta = enrichMealMeta(meal.name, meal.instructions);
    meta.ingredients = (meta.ingredients ?? []).map((item) =>
      item.name === ingredientName ? { name: replacement, serving: item.serving } : item,
    );
    meta.status = 'modified';
    const result = await nutritionService.updateMeal(meal.id, { instructions: serializeMealMeta(meta) });
    if (!result.success) {
      Alert.alert('Error', result.error);
      return;
    }
    void syncGroceriesAfterReplace();
    await applySavedMeals([result.data]);
  }

  async function handleSmartReplace(anchorMeal: Meal, payload: SmartReplacementPayload) {
    if (!user) return;
    const ingredientName = replaceIngredientName;
    const mode = replaceMode;
    setReplaceMeal(null);
    setReplaceIngredientName(null);
    const targets = selectMealsForScope(
      anchorMeal,
      weekMeals,
      payload.scope,
      mode === 'ingredient' ? ingredientName ?? undefined : undefined,
    );
    const savedMeals: Meal[] = [];

    for (const target of targets) {
      const updates = buildSmartReplacementUpdate(
        target,
        mode,
        ingredientName ?? undefined,
        {
          items: payload.items.map((item) => ({
            foodName: item.foodName,
            servingSize: item.servingSize,
            macros: item.macros,
          })),
          macros: payload.macros,
        },
      );
      const result = await nutritionService.updateMeal(target.id, updates);
      if (!result.success) {
        Alert.alert('Error', result.error);
        return;
      }
      savedMeals.push(result.data);
    }

    void syncGroceriesAfterReplace();
    await applySavedMeals(savedMeals);
  }

  if (loading && !refreshing && weekMeals.length === 0 && goals == null) {
    return (
      <ScreenContainer>
        <HeroPhotoBanner uri={HeroImages.dashboard.nutritionPrep} height={152} title="Nutrition" />
        <SkeletonBlock height={120} />
        <SkeletonBlock height={48} />
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
      testID="nutrition-screen"
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={LiftFlowColors.primary} />
      }>
      <HeroPhotoBanner
        uri={HeroImages.dashboard.nutritionPrep}
        height={168}
        showBrand={false}
        eyebrow="Meals"
        title="Fuel the work"
        subtitle={formatScheduleSubtitle(schedule)}
      />

      <HomePlanAdjustedBanner />

      <Pressable onPress={() => router.push('/(features)/nutrition-preferences')} style={styles.prefsRow}>
        <AppText variant="caption" color="accent">
          Preferences →
        </AppText>
      </Pressable>

      <FeatureGate
        featureId="nutrition-intelligence"
        fallback={
          <Pressable onPress={() => router.push('/(features)/upgrade')}>
            <Card style={styles.intelCard}>
              <AppText variant="label" color="accent">
                Nutrition Intelligence
              </AppText>
              <AppText variant="footnote" color="textSecondary">
                Pro insights from your logs, plan, and recovery — see macro gaps and coach tips tailored to today.
              </AppText>
              <AppText variant="caption" color="accent">
                View with Pro →
              </AppText>
            </Card>
          </Pressable>
        }>
        <Pressable onPress={() => router.push('/(features)/nutrition-intelligence')}>
          <Card style={styles.intelCard}>
            <AppText variant="label" color="accent">
              Nutrition Intelligence
            </AppText>
            <AppText variant="footnote" color="textSecondary">
              Personalized insights from your logs, plan, and recovery
            </AppText>
          </Card>
        </Pressable>
      </FeatureGate>

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

      {weekMeals.length === 0 ? (
        <Card style={styles.empty}>
          <AppText variant="body" color="textSecondary">
            No weekly meal plan yet. Generate a coached plan for all seven days, or log meals manually.
          </AppText>
          <PrimaryButton label="Generate Weekly Meal Plan" onPress={ensureMealPlan} loading={generating} />
          <PrimaryButton label="Log a Meal" variant="secondary" onPress={() => setQuickLogOpen(true)} />
        </Card>
      ) : null}

      {section === 'today' && weekMeals.length > 0 ? (
        <>
          <NutritionProgressHeader
            summary={summary}
            goals={goals}
            mealsCompleted={mealAggregation.mealsCompleted}
            mealsTotal={mealAggregation.mealsTotal}
            caloriesConsumed={mealAggregation.caloriesConsumed}
            proteinG={mealAggregation.proteinG}
          />
          <SectionHeader
            title="Today's Plan"
            variant="secondary"
            action={
              <Pressable onPress={() => setQuickLogOpen(true)} hitSlop={8}>
                <AppText variant="caption" color="accent">
                  + Log meal
                </AppText>
              </Pressable>
            }
          />
          {todayMeals.length === 0 ? (
            <Card style={styles.empty}>
              <AppText variant="body" color="textSecondary">
                No meals scheduled for today. Check the Week tab or pull to refresh.
              </AppText>
              <PrimaryButton label="Log a Meal" onPress={() => setQuickLogOpen(true)} />
            </Card>
          ) : (
            <View testID="meal-list" style={styles.mealList}>
              {todayMeals.map((meal, index) => (
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
              ))}
            </View>
          )}
        </>
      ) : null}

      {section === 'week' && weekMeals.length > 0 ? (
        <>
          <NutritionMetricsRow
            layout="rows"
            caloriesLabel="Calories"
            caloriesValue={String(weekAggregation.caloriesConsumed)}
            caloriesFooter={`of ${weekAggregation.plannedCalories} planned`}
            proteinLabel="Protein"
            proteinValue={`${Math.round(weekAggregation.proteinG)}g`}
            proteinFooter={`of ${Math.round(weekAggregation.plannedProteinG)}g planned`}
            mealsLabel="Meals"
            mealsValue={`${weekAggregation.mealsCompleted}/${weekAggregation.mealsTotal}`}
            mealsFooter="logged this week"
          />
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
                        <MealPlanCard
                          key={meal.id}
                          meal={meal}
                          scheduledTime={times[index]}
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
                      );
                    })
                  : null}
              </Card>
              ))}
        </>
      ) : null}

      {section === 'shopping' ? (
        <>
          <Card style={styles.intelCard}>
            <AppText variant="label" color="accent">
              Weekly shopping
            </AppText>
            <AppText variant="footnote" color="textSecondary">
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
    paddingBottom: Spacing.huge,
  },
  errorContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  prefsRow: {
    alignSelf: 'flex-end',
    marginTop: -Spacing.sm,
  },
  mealList: {
    gap: Spacing.md,
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
  dayCard: {
    gap: Spacing.sm,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
