import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  InteractionManager,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

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
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
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
    mealNameFromIngredients,
    resolveMealMacrosFromIngredients,
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
import type { DailyNutritionSummary, GroceryList, GroceryListItem, Meal, NutritionGoals } from '@/types';
import type { MealType } from '@/types/common';

/** Service errors surface raw transport strings like "API error 500"; users need plain language. */
function friendlyMealError(raw: string): string {
  if (/network|fetch|timeout|timed out/i.test(raw)) {
    return "We couldn't reach your meal plan. Check your connection and try again.";
  }
  if (/^API error|\b(4\d\d|5\d\d)\b/.test(raw)) {
    return 'Something went wrong on our end. Please try again in a moment.';
  }
  return raw;
}

function formatGroceryQuantity(item: GroceryListItem): string {
  if (item.quantity == null) return item.unit ?? '';
  const amount = Math.round(item.quantity * 10) / 10;
  return item.unit ? `${amount} ${item.unit}` : `${amount}`;
}

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
  const [newItemName, setNewItemName] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const [markingMealId, setMarkingMealId] = useState<string | null>(null);
  const [replacingMealId, setReplacingMealId] = useState<string | null>(null);
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
  const foodPreferences = useMemo(
    () => user?.metadata?.coachProfile?.foodPreferences ?? [],
    [user?.metadata?.coachProfile?.foodPreferences],
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
          const synced = await nutritionService.syncGroceryListFromMeals(user.id, from, to);
          if (generation !== loadGenerationRef.current) return;
          if (synced.success && synced.data) {
            setGroceryList(synced.data);
            return;
          }
          const groceryRes = await nutritionService.getGroceryLists(user.id);
          if (generation !== loadGenerationRef.current) return;
          if (groceryRes.success && groceryRes.data?.[0]) setGroceryList(groceryRes.data[0]);
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

  const groupedGroceryItems = useMemo(() => {
    const groups: Record<string, GroceryListItem[]> = {};
    for (const item of groceryList?.items ?? []) {
      const category = item.category?.trim() || 'Other';
      (groups[category] ??= []).push(item);
    }
    for (const items of Object.values(groups)) {
      items.sort((a, b) => Number(a.isChecked) - Number(b.isChecked) || a.sortOrder - b.sortOrder);
    }
    return groups;
  }, [groceryList]);

  const checkedCount = useMemo(
    () => (groceryList?.items ?? []).filter((item) => item.isChecked).length,
    [groceryList],
  );

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
    carbsG?: number;
    fatG?: number;
  }) {
    if (!user) return;
    const result = await nutritionService.logFood(user.id, {
      ...payload,
      date: today,
    });
    if (result.success) {
      await load();
    } else {
      Alert.alert('Could not log meal', friendlyMealError(result.error));
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
      const result = await nutritionService.generateWeeklyMealPlan(user.id, tz, {
        dietaryRestrictions,
        foodPreferences,
      });

      if (!result.success) {
        Alert.alert('Could not generate meal plan', friendlyMealError(result.error));
        return;
      }

      const meals = result.data.meals ?? [];
      if (meals.length === 0) {
        Alert.alert('Could not generate meal plan', 'No meals were saved. Pull to refresh and try again.');
        return;
      }

      loadGenerationRef.current += 1;
      setWeekMeals(meals);

      // Generation writes the macro targets the plan was built around, so the local copy is stale
      // the moment it returns. Without this the screen shows the new meals against the old goal.
      const refreshedGoals = await nutritionService.getGoals(user.id);
      const activeGoals = refreshedGoals.success && refreshedGoals.data ? refreshedGoals.data : goals;
      if (refreshedGoals.success && refreshedGoals.data) setGoals(refreshedGoals.data);

      setSummary((prev) => buildDailySummaryFromMeals(meals, today, activeGoals, prev?.waterMl ?? 0));
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
    if (!result.success) {
      Alert.alert('Could not update meal', friendlyMealError(result.error));
      return;
    }
    setGroceryList(result.data);
    const { from, to } = getWeekRange(new Date(), user.timezone);
    const synced = await nutritionService.syncGroceryListFromMeals(user.id, from, to);
    if (synced.success && synced.data) setGroceryList(synced.data);
  }

  async function handleToggleGroceryItem(itemId: string, isChecked: boolean) {
    setGroceryList((current) =>
      current
        ? { ...current, items: current.items.map((item) => (item.id === itemId ? { ...item, isChecked } : item)) }
        : current,
    );
    const result = await nutritionService.setGroceryItemChecked(itemId, isChecked);
    if (!result.success) {
      setGroceryList((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) => (item.id === itemId ? { ...item, isChecked: !isChecked } : item)),
            }
          : current,
      );
      Alert.alert('Could not update item', friendlyMealError(result.error));
    }
  }

  async function handleAddGroceryItem() {
    const name = newItemName.trim();
    if (!groceryList || !name || addingItem) return;
    setAddingItem(true);
    try {
      const result = await nutritionService.addGroceryItem(groceryList.id, { name });
      if (!result.success) {
        Alert.alert('Could not add item', friendlyMealError(result.error));
        return;
      }
      setGroceryList(result.data);
      setNewItemName('');
    } finally {
      setAddingItem(false);
    }
  }

  async function handleMarkMeal(meal: Meal, status: 'completed' | 'modified' | 'skipped') {
    // Fire-and-forget meant a second tap logged the same meal twice against the day's calories.
    if (markingMealId) return;
    setMarkingMealId(meal.id);
    try {
      const result = await nutritionService.markMealStatus(
        meal.id,
        meal.name,
        meal.instructions,
        status,
      );
      if (!result.success) {
        Alert.alert('Could not update meal', friendlyMealError(result.error));
        return;
      }
      AccessibilityInfo.announceForAccessibility(
        status === 'completed'
          ? `${meal.name} logged`
          : status === 'skipped'
            ? `${meal.name} skipped`
            : `${meal.name} updated`,
      );
      await load();
    } finally {
      setMarkingMealId(null);
    }
  }

  async function handleReplaceMeal(meal: Meal, option: MealAlternativeOption) {
    if (replacingMealId) return;
    setReplacingMealId(meal.id);
    setReplaceMeal(null);
    try {
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
        Alert.alert('Could not update meal', friendlyMealError(result.error));
        return;
      }
      void syncGroceriesAfterReplace();
      await applySavedMeals([result.data]);
    } finally {
      setReplacingMealId(null);
    }
  }

  async function handleReplaceIngredient(ingredientName: string, replacement: string) {
    if (!replaceMeal || replacingMealId) return;
    const meal = replaceMeal;
    setReplacingMealId(meal.id);
    setReplaceMeal(null);
    try {
      const meta = enrichMealMeta(meal.name, meal.instructions);
      meta.ingredients = (meta.ingredients ?? []).map((item) =>
        item.name === ingredientName ? { name: replacement, serving: item.serving } : item,
      );
      meta.status = 'modified';
      const instructions = serializeMealMeta(meta);
      const nextName = mealNameFromIngredients(meta.ingredients ?? []) ?? meal.name;
      const nextMacros = resolveMealMacrosFromIngredients(nextName, instructions);
      const result = await nutritionService.updateMeal(meal.id, {
        name: nextName,
        calories: nextMacros.calories,
        proteinG: nextMacros.proteinG,
        carbsG: nextMacros.carbsG,
        fatG: nextMacros.fatG,
        instructions,
      });
      if (!result.success) {
        Alert.alert('Could not update meal', friendlyMealError(result.error));
        return;
      }
      void syncGroceriesAfterReplace();
      await applySavedMeals([result.data]);
    } finally {
      setReplacingMealId(null);
    }
  }

  async function handleSmartReplace(anchorMeal: Meal, payload: SmartReplacementPayload) {
    if (!user || replacingMealId) return;
    const ingredientName = replaceIngredientName;
    const mode = replaceMode;
    setReplacingMealId(anchorMeal.id);
    const targets = selectMealsForScope(
      anchorMeal,
      weekMeals,
      payload.scope,
      mode === 'ingredient' ? ingredientName ?? undefined : undefined,
    );
    if (targets.length === 0) {
      setReplacingMealId(null);
      Alert.alert('Could not update meal', 'No matching meal slots were found to replace.');
      return;
    }

    try {
      const results = await Promise.all(
        targets.map(async (target) => {
          const updates = buildSmartReplacementUpdate(
            target,
            mode,
            ingredientName ?? undefined,
            {
              foodName: payload.foodName,
              servingSize: payload.servingSize,
              macros: payload.macros,
            },
          );
          return nutritionService.updateMeal(target.id, updates);
        }),
      );

      const failure = results.find((result) => !result.success);
      if (failure && !failure.success) {
        Alert.alert('Could not update meal', friendlyMealError(failure.error));
        return;
      }

      const savedMeals = results
        .filter((result): result is typeof result & { success: true } => result.success)
        .map((result) => result.data);

      setReplaceMeal(null);
      setReplaceIngredientName(null);
      void syncGroceriesAfterReplace();
      await applySavedMeals(savedMeals);
    } finally {
      setReplacingMealId(null);
    }
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
      keyboardAvoiding
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
                No meals scheduled for today. Check the Week tab or pull to refresh.
              </AppText>
              <PrimaryButton label="Log a Meal" onPress={() => setQuickLogOpen(true)} />
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
                pending={markingMealId === meal.id}
              />
            ))
          )}
        </>
      ) : null}

      {section === 'week' && weekMeals.length > 0 ? (
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
      ) : null}

      {section === 'shopping' ? (
        <>
          <Card style={styles.weekSummary}>
            <AppText variant="label" color="accent">
              Weekly shopping
            </AppText>
            <AppText variant="body" color="textSecondary">
              {weekRange.from} – {weekRange.to} · {weekMeals.length} planned meals ·{' '}
              {groceryList ? `${checkedCount} / ${groceryList.items.length} picked up` : `${shoppingItems.length} items`}
            </AppText>
          </Card>
          <PrimaryButton label="Refresh Shopping List" variant="secondary" onPress={handleGenerateShoppingList} />

          {groceryList ? (
            <>
              <Card style={styles.shoppingCard}>
                <AppText variant="caption" color="textSecondary">
                  Add an item
                </AppText>
                <View style={styles.addRow}>
                  <TextInput
                    style={styles.addInput}
                    value={newItemName}
                    onChangeText={setNewItemName}
                    placeholder="e.g. Olive oil"
                    placeholderTextColor={LiftFlowColors.textTertiary}
                    returnKeyType="done"
                    onSubmitEditing={() => void handleAddGroceryItem()}
                  />
                  <Pressable
                    onPress={() => void handleAddGroceryItem()}
                    disabled={!newItemName.trim() || addingItem}
                    hitSlop={8}
                    style={styles.addButton}>
                    <AppText variant="caption" color={newItemName.trim() ? 'accent' : 'textTertiary'}>
                      Add
                    </AppText>
                  </Pressable>
                </View>
              </Card>
              {groceryList.items.length === 0 ? (
                <Card style={styles.shoppingCard}>
                  <AppText variant="body" color="textSecondary">
                    Nothing on your list yet. Add items above, or generate a meal plan to fill it
                    from your meals.
                  </AppText>
                </Card>
              ) : (
                Object.entries(groupedGroceryItems).map(([category, items]) => (
                  <Card key={category} style={styles.shoppingCard}>
                    <AppText variant="label" color="accent">
                      {category}
                    </AppText>
                    {items.map((item) => (
                      <Pressable
                        key={item.id}
                        style={styles.shoppingRow}
                        onPress={() => void handleToggleGroceryItem(item.id, !item.isChecked)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: item.isChecked }}
                        accessibilityLabel={`${item.name}, ${formatGroceryQuantity(item)}`}>
                        <View style={styles.shoppingLabel}>
                          <View style={[styles.checkbox, item.isChecked && styles.checkboxChecked]}>
                            {item.isChecked ? (
                              <AppText variant="caption" color="accent">
                                ✓
                              </AppText>
                            ) : null}
                          </View>
                          <AppText variant="bodyBold" color={item.isChecked ? 'textTertiary' : 'textPrimary'}>
                            {item.name}
                          </AppText>
                        </View>
                        <AppText variant="footnote" color="textSecondary">
                          {formatGroceryQuantity(item)}
                        </AppText>
                      </Pressable>
                    ))}
                  </Card>
                ))
              )}
            </>
          ) : shoppingItems.length === 0 ? (
            <Card style={styles.shoppingCard}>
              <AppText variant="body" color="textSecondary">
                Your shopping list is empty. Generate a meal plan and its ingredients will show up
                here.
              </AppText>
            </Card>
          ) : (
            // Read-only view: these come straight from the meal plan rather than a saved list, so
            // the rows deliberately have no checkboxes.
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
        pending={replacingMealId != null}
        onClose={() => {
          if (replacingMealId) return;
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
        pending={detailMeal != null && markingMealId === detailMeal.id}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LiftFlowColors.border,
  },
  shoppingLabel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    borderColor: LiftFlowColors.accent,
    backgroundColor: 'rgba(31, 107, 255, 0.12)',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  addInput: {
    flex: 1,
    backgroundColor: LiftFlowColors.backgroundSecondary,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: LiftFlowColors.textPrimary,
    fontSize: 16,
  },
  addButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
});
