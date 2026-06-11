import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { withScreenBoundary } from '@/components/observability/withScreenBoundary';
import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { UpgradePrompt } from '@/components/subscription/UpgradePrompt';
import { AppText } from '@/components/ui/AppText';
import { VoiceUnavailableMessage } from '@/components/voice/VoiceUnavailableMessage';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { useEntitlement } from '@/hooks/useEntitlement';
import { useUnits } from '@/hooks/useUnits';
import { parseNutritionVoice } from '@/lib/nutritionVoice';
import { parseVoiceCommandLocal } from '@/lib/voice/parseVoiceCommand';
import { forensicLog, forensicLogError } from '@/lib/forensicLog';
import { nutritionIntelligenceService } from '@/services/nutritionIntelligenceService';
import { nutritionService } from '@/services/nutritionService';
import type { DailyNutritionSummary, GroceryList, Meal, MealType, NutritionGoals } from '@/types';

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout'];

function NutritionScreen() {
  useEffect(() => {
    forensicLog('NUTRITION_LOAD_START');
    return () => {
      forensicLog('NUTRITION_LOAD_SUCCESS', { phase: 'unmount' });
    };
  }, []);
  const { user } = useAuth();
  const { allowed: nutritionIntelAllowed } = useEntitlement('nutrition-intelligence');
  const units = useUnits();
  const [goals, setGoals] = useState<NutritionGoals | null>(null);
  const [summary, setSummary] = useState<DailyNutritionSummary | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [groceryList, setGroceryList] = useState<GroceryList | null>(null);
  const [loading, setLoading] = useState(true);

  const [entryMode, setEntryMode] = useState<'food' | 'supplement'>('food');
  const [mealType, setMealType] = useState<MealType>('snack');
  const [foodName, setFoodName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

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

  function resetForm() {
    setFoodName('');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
  }

  function applyParsedEntry(parsed: ReturnType<typeof parseNutritionVoice>) {
    if (!parsed) return;
    setEntryMode(parsed.isSupplement ? 'supplement' : 'food');
    setMealType(parsed.mealType);
    setFoodName(parsed.name);
    if (parsed.calories != null) setCalories(String(parsed.calories));
    if (parsed.proteinG != null) setProtein(String(parsed.proteinG));
    if (parsed.carbsG != null) setCarbs(String(parsed.carbsG));
    if (parsed.fatG != null) setFat(String(parsed.fatG));
  }

  async function handleVoiceLog(text: string) {
    clearTranscript();
    const command = parseVoiceCommandLocal(text, {});
    if (command?.intent === 'nutrition_query' || command?.intent === 'grocery_list_query') {
      if (!user) return;
      if (!nutritionIntelAllowed) {
        Alert.alert('Pro feature', 'Nutrition Intelligence requires ONE MORE Pro.');
        router.push('/(features)/upgrade');
        return;
      }
      const result = await nutritionIntelligenceService.getIntelligence(user.id);
      if (!result.success) {
        Alert.alert('Nutrition unavailable', result.error);
        return;
      }
      const line =
        command.intent === 'grocery_list_query'
          ? result.data.voiceGroceryLine
          : result.data.voiceEatTodayLine;
      Alert.alert(command.intent === 'grocery_list_query' ? 'Shopping list' : 'Eat today', line);
      return;
    }

    const parsed = parseNutritionVoice(text);
    if (!parsed) {
      Alert.alert(
        'Could not parse',
        'Try: "What should I eat today?", "Build my shopping list", or "Protein shake 250 calories 30g protein"',
      );
      return;
    }
    applyParsedEntry(parsed);

    if (parsed.calories || parsed.proteinG || parsed.isSupplement) {
      await saveEntry(parsed.name, parsed.mealType, parsed.isSupplement, {
        calories: parsed.calories,
        proteinG: parsed.proteinG,
        carbsG: parsed.carbsG,
        fatG: parsed.fatG,
      });
    }
  }

  async function saveEntry(
    name: string,
    type: MealType,
    isSupplement: boolean | undefined,
    macros: { calories?: number; proteinG?: number; carbsG?: number; fatG?: number },
  ) {
    if (!user || !name.trim()) return;

    const result = await nutritionService.logFood(user.id, {
      name: name.trim(),
      mealType: type,
      calories: macros.calories,
      proteinG: macros.proteinG,
      carbsG: macros.carbsG,
      fatG: macros.fatG,
      instructions: isSupplement ? 'supplement' : undefined,
    });

    if (result.success) {
      resetForm();
      load();
    } else {
      Alert.alert('Error', result.error);
    }
  }

  async function handleLogManual() {
    if (!foodName.trim()) {
      Alert.alert('Name required', 'Enter a food or supplement name.');
      return;
    }

    await saveEntry(foodName, mealType, entryMode === 'supplement', {
      calories: calories ? parseInt(calories, 10) : undefined,
      proteinG: protein ? parseFloat(protein) : undefined,
      carbsG: carbs ? parseFloat(carbs) : undefined,
      fatG: fat ? parseFloat(fat) : undefined,
    });
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

  const supplements = meals.filter((m) => m.instructions === 'supplement');
  const foods = meals.filter((m) => m.instructions !== 'supplement');

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
        <AppText variant="headline">Nutrition</AppText>
        <AppText variant="body" color="textSecondary">
          Track macros, meals, and supplements
        </AppText>
        <PrimaryButton
          label="Nutrition Intelligence"
          onPress={() =>
            nutritionIntelAllowed
              ? router.push('/(features)/nutrition-intelligence')
              : router.push('/(features)/upgrade')
          }
          variant="secondary"
        />
        {!nutritionIntelAllowed ? <UpgradePrompt featureId="nutrition-intelligence" compact /> : null}
      </View>

      <View style={styles.macroRow}>
        <MacroCard label="Calories" current={summary?.caloriesConsumed ?? 0} target={goals?.dailyCalories} unit="" />
        <MacroCard label="Protein" current={Math.round(summary?.proteinG ?? 0)} target={goals?.proteinG} unit="g" />
        <MacroCard label="Carbs" current={Math.round(summary?.carbsG ?? 0)} target={goals?.carbsG} unit="g" />
        <MacroCard label="Fat" current={Math.round(summary?.fatG ?? 0)} target={goals?.fatG} unit="g" />
      </View>

      {(user?.metadata?.coachActivation?.supplementRecommendations?.length ?? 0) > 0 ? (
        <Card style={styles.supplementCard}>
          <AppText variant="label" color="accent">
            AI Supplement Guidance
          </AppText>
          <AppText variant="footnote" color="textTertiary">
            Recommendations only — not medical advice.
          </AppText>
          {user?.metadata?.coachActivation?.supplementRecommendations?.slice(0, 4).map((rec) => (
            <View key={rec.name} style={styles.supplementRow}>
              <AppText variant="bodyBold">{rec.name}</AppText>
              <AppText variant="footnote" color="textSecondary">
                {rec.rationale}
              </AppText>
            </View>
          ))}
        </Card>
      ) : null}

      {(summary?.waterMl != null || summary?.waterTargetMl != null) ? (
        <Card style={styles.waterCard}>
          <AppText variant="caption" color="textSecondary">
            Water today
          </AppText>
          <AppText variant="bodyBold">
            {units.formatWater(summary?.waterMl ?? 0)}
            {summary?.waterTargetMl
              ? ` / ${units.formatWater(summary.waterTargetMl)}`
              : ''}
          </AppText>
        </Card>
      ) : null}

      <SectionHeader title="Log Entry" subtitle="Manual or voice — tap mic below" />

      <View style={styles.modeRow}>
        {(['food', 'supplement'] as const).map((mode) => (
          <Pressable
            key={mode}
            style={[styles.modeChip, entryMode === mode && styles.modeChipActive]}
            onPress={() => setEntryMode(mode)}>
            <AppText variant="caption" color={entryMode === mode ? 'accent' : 'textSecondary'}>
              {mode === 'food' ? 'Food' : 'Supplement'}
            </AppText>
          </Pressable>
        ))}
      </View>

      <Card style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder={entryMode === 'supplement' ? 'Supplement name' : 'Food name'}
          placeholderTextColor={LiftFlowColors.textTertiary}
          value={foodName}
          onChangeText={setFoodName}
        />

        <View style={styles.chipRow}>
          {MEAL_TYPES.map((type) => (
            <Pressable
              key={type}
              style={[styles.chip, mealType === type && styles.chipActive]}
              onPress={() => setMealType(type)}>
              <AppText variant="caption" color={mealType === type ? 'accent' : 'textSecondary'}>
                {type.replace('_', ' ')}
              </AppText>
            </Pressable>
          ))}
        </View>

        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, styles.inputQuarter]}
            placeholder="Cal"
            placeholderTextColor={LiftFlowColors.textTertiary}
            keyboardType="numeric"
            value={calories}
            onChangeText={setCalories}
          />
          <TextInput
            style={[styles.input, styles.inputQuarter]}
            placeholder="Protein"
            placeholderTextColor={LiftFlowColors.textTertiary}
            keyboardType="numeric"
            value={protein}
            onChangeText={setProtein}
          />
          <TextInput
            style={[styles.input, styles.inputQuarter]}
            placeholder="Carbs"
            placeholderTextColor={LiftFlowColors.textTertiary}
            keyboardType="numeric"
            value={carbs}
            onChangeText={setCarbs}
          />
          <TextInput
            style={[styles.input, styles.inputQuarter]}
            placeholder="Fat"
            placeholderTextColor={LiftFlowColors.textTertiary}
            keyboardType="numeric"
            value={fat}
            onChangeText={setFat}
          />
        </View>

        <PrimaryButton
          label={entryMode === 'supplement' ? 'Add Supplement' : 'Add Food'}
          onPress={handleLogManual}
        />
      </Card>

      <View style={styles.micRow}>
        <VoiceUnavailableMessage />
      </View>

      <SectionHeader title="Today's Meals" />
      {foods.length === 0 ? (
        <AppText variant="body" color="textSecondary">
          No meals logged today.
        </AppText>
      ) : (
        foods.map((meal) => <MealRow key={meal.id} meal={meal} />)
      )}

      <SectionHeader title="Supplements" />
      {supplements.length === 0 ? (
        <AppText variant="body" color="textSecondary">
          No supplements logged today.
        </AppText>
      ) : (
        supplements.map((meal) => <MealRow key={meal.id} meal={meal} isSupplement />)
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

function MealRow({ meal, isSupplement }: { meal: Meal; isSupplement?: boolean }) {
  const parts = [
    meal.calories != null ? `${meal.calories} cal` : null,
    meal.proteinG != null ? `${meal.proteinG}g P` : null,
    meal.carbsG != null ? `${meal.carbsG}g C` : null,
    meal.fatG != null ? `${meal.fatG}g F` : null,
  ].filter(Boolean);

  return (
    <Card style={styles.mealCard}>
      <AppText variant="bodyBold">
        {meal.name}
        {isSupplement ? ' · Supplement' : ''}
      </AppText>
      <AppText variant="footnote" color="textSecondary">
        {parts.length > 0 ? parts.join(' · ') : 'No macros logged'}
      </AppText>
    </Card>
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
  supplementCard: {
    gap: Spacing.sm,
    marginBottom: Spacing.xxl,
  },
  supplementRow: {
    gap: Spacing.xs,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LiftFlowColors.border,
  },
  waterCard: {
    gap: Spacing.xs,
    marginBottom: Spacing.xxl,
  },
  modeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  modeChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: LiftFlowColors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.border,
  },
  modeChipActive: {
    borderColor: LiftFlowColors.accentMuted,
    backgroundColor: LiftFlowColors.accentGlow,
  },
  form: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  input: {
    backgroundColor: LiftFlowColors.background,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    color: LiftFlowColors.textPrimary,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  inputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  inputQuarter: {
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: LiftFlowColors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.border,
  },
  chipActive: {
    borderColor: LiftFlowColors.accentMuted,
    backgroundColor: LiftFlowColors.accentGlow,
  },
  micRow: {
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xxl,
  },
  micHint: {
    textAlign: 'center',
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

export default withScreenBoundary(NutritionScreen, 'Nutrition');
