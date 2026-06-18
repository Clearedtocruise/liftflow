import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ConversationalCoachPanel } from '@/components/coaching/ConversationalCoachPanel';
import { RecoveryCheckInForm } from '@/components/coaching/RecoveryCheckInForm';
import { RecoveryScoreCard } from '@/components/coaching/RecoveryScoreCard';
import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { NutritionIntelligenceDashboard } from '@/components/nutrition/NutritionIntelligenceDashboard';
import { RecoveryIntelligenceDashboard } from '@/components/recovery/RecoveryIntelligenceDashboard';
import { FeatureGate } from '@/components/subscription/PremiumGate';
import { UpgradePrompt } from '@/components/subscription/UpgradePrompt';
import { AppText } from '@/components/ui/AppText';
import { WorkoutRecommendationPanel } from '@/components/workout/WorkoutRecommendationPanel';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { aiService } from '@/services/aiService';
import { conversationalCoachService } from '@/services/conversationalCoachService';
import { nutritionIntelligenceService } from '@/services/nutritionIntelligenceService';
import { nutritionService } from '@/services/nutritionService';
import { recoveryService } from '@/services/recoveryService';
import { workoutRecommendationService } from '@/services/workoutRecommendationService';
import type { AIRecommendation } from '@/types';
import type { DailyRecoveryCheckIn, RecoveryTrendPoint } from '@/types/coaching';
import { COACH_STARTER_QUESTIONS } from '@/types/conversationalCoach';
import type { NutritionIntelligenceReport } from '@/types/nutritionIntelligence';
import type { RecoveryIntelligenceReport } from '@/types/recoveryIntelligence';
import type { WorkoutRecommendationReport } from '@/types/workoutRecommendation';

export default function CoachingScreen() {
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [checkIn, setCheckIn] = useState<DailyRecoveryCheckIn | null>(null);
  const [intelligence, setIntelligence] = useState<RecoveryIntelligenceReport | null>(null);
  const [workoutRec, setWorkoutRec] = useState<WorkoutRecommendationReport | null>(null);
  const [nutritionIntel, setNutritionIntel] = useState<NutritionIntelligenceReport | null>(null);
  const [trend, setTrend] = useState<RecoveryTrendPoint[]>([]);
  const [macroRationale, setMacroRationale] = useState<string | null>(null);
  const [macroError, setMacroError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatedWorkout, setGeneratedWorkout] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [coachAnswer, setCoachAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [intelError, setIntelError] = useState<string | null>(null);
  const [workoutRecError, setWorkoutRecError] = useState<string | null>(null);
  const [nutritionIntelError, setNutritionIntelError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;

    const [today, trendRes, macros] = await Promise.all([
      recoveryService.getToday(user.id),
      recoveryService.getTrend(user.id),
      nutritionService.getAdaptiveTargets(user.id),
    ]);

    if (today.success && today.data) setCheckIn(today.data);
    if (trendRes.success) setTrend(trendRes.data);

    if (isPremium) {
      const [recs, intel, workoutRecommendation, nutritionReport] = await Promise.all([
        aiService.getRecommendations(user.id),
        recoveryService.getIntelligence(user.id),
        workoutRecommendationService.getDaily(user.id),
        nutritionIntelligenceService.getIntelligence(user.id),
      ]);
      if (recs.success) setRecommendations(recs.data);
      else setRecommendations([]);
      if (intel.success) {
        setIntelligence(intel.data);
        setIntelError(null);
      } else {
        setIntelligence(null);
        setIntelError(intel.error);
      }
      if (workoutRecommendation.success) {
        setWorkoutRec(workoutRecommendation.data);
        setWorkoutRecError(null);
      } else {
        setWorkoutRec(null);
        setWorkoutRecError(workoutRecommendation.error);
      }
      if (nutritionReport.success) {
        setNutritionIntel(nutritionReport.data);
        setNutritionIntelError(null);
      } else {
        setNutritionIntel(null);
        setNutritionIntelError(nutritionReport.error);
      }
    } else {
      setRecommendations([]);
      setIntelligence(null);
      setWorkoutRec(null);
      setNutritionIntel(null);
      setIntelError(null);
      setWorkoutRecError(null);
      setNutritionIntelError(null);
    }

    if (macros.success) {
      setMacroRationale(macros.data.rationale);
      setMacroError(null);
    } else {
      setMacroRationale(null);
      setMacroError(macros.error || 'Adaptive nutrition is unavailable. Check your connection or try again later.');
    }
    setLoading(false);
    setRefreshing(false);
  }, [user, isPremium]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRefresh() {
    if (!user || !isPremium) return;
    setRefreshing(true);
    await aiService.refreshCoaching(user.id);
    load();
  }

  async function handleGenerateWorkout() {
    if (!user) return;
    setGenerating(true);
    const result = await aiService.generateWorkoutPlan(user.id);
    setGenerating(false);
    if (result.success) {
      const exercises = (result.data.metadata as { exercises?: { name: string; sets: number; reps: string }[] })?.exercises ?? [];
      const summary = exercises.map((e) => `${e.name}: ${e.sets}×${e.reps}`).join('\n');
      setGeneratedWorkout(`${result.data.name}\n\n${result.data.aiRationale}\n\n${summary}`);
      Alert.alert('Workout generated', result.data.name);
    } else {
      Alert.alert('Generation failed', result.error ?? '');
    }
  }

  async function handleSmartQuestion(question: string) {
    if (!user) return;
    setAsking(true);
    const result = await conversationalCoachService.ask(user.id, {
      context: 'general',
      message: question,
      includeHistory: true,
      detailLevel: 'detailed',
    });
    setAsking(false);
    if (result.success) setCoachAnswer(result.data.detailedAnswer);
    else Alert.alert('Coach unavailable', result.error);
  }

  async function handleDailyMealPlan() {
    if (!user) return;
    const result = await nutritionService.generateDailyPlan(user.id, 'high_protein');
    if (result.success) {
      Alert.alert(
        'Daily meal plan',
        `${result.data.meals.map((m) => `${m.mealType}: ${m.name}`).join('\n')}\n\n${result.data.rationale}`,
      );
    } else {
      Alert.alert(
        'Meal plan unavailable',
        result.error || 'Could not generate your daily meal plan. The nutrition service may be offline.',
      );
    }
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={LiftFlowColors.accent} />
      </View>
    );
  }

  return (
    <ScreenContainer
      refreshControl={
        isPremium ? <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={LiftFlowColors.accent} /> : undefined
      }>
      <View style={styles.header}>
        <AppText variant="title">AI Coaching</AppText>
        <AppText variant="body" color="textSecondary">
          Recovery, training, and nutrition guidance
        </AppText>
      </View>

      <RecoveryScoreCard checkIn={checkIn} trend={trend} />

      {intelligence ? (
        <FeatureGate featureId="recovery-intelligence" hidePaywall>
          <RecoveryIntelligenceDashboard report={intelligence} compact />
        </FeatureGate>
      ) : isPremium ? (
        <Card style={styles.fallbackCard}>
          <AppText variant="footnote" color="textSecondary">
            {intelError ?? 'Recovery intelligence is temporarily unavailable.'}
          </AppText>
          <PrimaryButton label="Retry" onPress={() => void load()} variant="secondary" />
        </Card>
      ) : (
        <UpgradePrompt featureId="recovery-intelligence" />
      )}

      {workoutRec ? (
        <FeatureGate featureId="workout-recommendations" hidePaywall>
          <WorkoutRecommendationPanel report={workoutRec} compact />
        </FeatureGate>
      ) : isPremium ? (
        <Card style={styles.fallbackCard}>
          <AppText variant="footnote" color="textSecondary">
            {workoutRecError ?? 'Workout recommendations are temporarily unavailable.'}
          </AppText>
          <PrimaryButton label="Retry" onPress={() => void load()} variant="secondary" />
        </Card>
      ) : (
        <UpgradePrompt featureId="workout-recommendations" compact />
      )}

      {nutritionIntel ? (
        <FeatureGate featureId="nutrition-intelligence" hidePaywall>
          <NutritionIntelligenceDashboard report={nutritionIntel} compact />
        </FeatureGate>
      ) : isPremium ? (
        <Card style={styles.fallbackCard}>
          <AppText variant="footnote" color="textSecondary">
            {nutritionIntelError ?? 'Nutrition intelligence is temporarily unavailable.'}
          </AppText>
          <PrimaryButton label="Retry" onPress={() => void load()} variant="secondary" />
        </Card>
      ) : (
        <UpgradePrompt featureId="nutrition-intelligence" compact />
      )}

      <View style={styles.linkRow}>
        <PrimaryButton label="Today's Workout" onPress={() => router.push('/(features)/suggested-workouts')} variant="secondary" />
        <PrimaryButton label="Nutrition Intelligence" onPress={() => router.push('/(features)/nutrition-intelligence')} variant="secondary" />
        <PrimaryButton label="Coach Chat" onPress={() => router.push('/(features)/coach-chat')} variant="secondary" />
        <PrimaryButton label="Recovery Dashboard" onPress={() => router.push('/(features)/recovery-analysis')} variant="secondary" />
        <PrimaryButton label="Daily Check-in" onPress={() => router.push('/(features)/recovery-check-in')} variant="secondary" />
        <PrimaryButton label="Weekly Check-in" onPress={() => router.push('/(features)/weekly-check-in')} variant="secondary" />
        <PrimaryButton label="Limitations" onPress={() => router.push('/(features)/limitations')} variant="secondary" />
      </View>

      {!checkIn ? <RecoveryCheckInForm userId={user!.id} onComplete={(r) => { setCheckIn(r); load(); }} /> : null}

      {macroRationale ? (
        <Card style={styles.macroCard}>
          <AppText variant="caption" color="accent">
            Workout-aware nutrition
          </AppText>
          <AppText variant="footnote" color="textSecondary">
            {macroRationale}
          </AppText>
          <PrimaryButton label="Generate today's meals" onPress={handleDailyMealPlan} variant="secondary" />
        </Card>
      ) : macroError ? (
        <Card style={styles.macroCard}>
          <AppText variant="caption" color="accent">
            Workout-aware nutrition
          </AppText>
          <AppText variant="footnote" color="textSecondary">
            {macroError}
          </AppText>
          <PrimaryButton
            label="Retry nutrition targets"
            onPress={() => {
              setLoading(true);
              load();
            }}
            variant="secondary"
          />
        </Card>
      ) : null}

      <SectionHeader title="Smart Coach Questions" />
      <FeatureGate featureId="ai-coach">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.questionRow}>
        {COACH_STARTER_QUESTIONS.map((q) => (
          <Pressable key={q.topic} style={styles.questionChip} onPress={() => handleSmartQuestion(q.label)} disabled={asking}>
            <AppText variant="caption">{q.label}</AppText>
          </Pressable>
        ))}
      </ScrollView>
      {coachAnswer ? (
        <Card style={styles.answerCard}>
          <AppText variant="body">{coachAnswer}</AppText>
        </Card>
      ) : null}
      </FeatureGate>

      <FeatureGate featureId="voice-coaching">
        <ConversationalCoachPanel compact context="general" />
      </FeatureGate>

      <FeatureGate featureId="ai-coach" featureName="AI workout generation">
        <Card style={styles.actionCard}>
          <AppText variant="bodyBold">Generate today&apos;s workout</AppText>
          <AppText variant="caption" color="textSecondary">
            Uses recovery score, limitations, and exercise history.
          </AppText>
          <PrimaryButton
            label={generating ? 'Generating…' : 'Generate AI Workout'}
            onPress={handleGenerateWorkout}
            variant="secondary"
            disabled={generating}
          />
          {generatedWorkout ? (
            <AppText variant="footnote" color="textSecondary" style={styles.workoutPreview}>
              {generatedWorkout}
            </AppText>
          ) : null}
        </Card>
      </FeatureGate>

      {isPremium ? (
        <PrimaryButton label="Refresh Recommendations" onPress={handleRefresh} variant="secondary" />
      ) : (
        <FeatureGate featureId="ai-coach" featureName="AI recommendations refresh" />
      )}

      <SectionHeader title="Recommendations" subtitle="Based on recovery, load, and goals" />

      {recommendations.length === 0 ? (
        <AppText variant="body" color="textSecondary">
          Complete a check-in and a few workouts to unlock personalized coaching.
        </AppText>
      ) : (
        recommendations.map((rec) => (
          <Card key={rec.id} style={styles.recCard}>
            <AppText variant="caption" color="accent">
              {rec.recommendationType.replace('_', ' ')}
            </AppText>
            <AppText variant="bodyBold">{rec.title}</AppText>
            <AppText variant="body" color="textSecondary">
              {rec.description}
            </AppText>
            {rec.rationale ? (
              <AppText variant="footnote" color="textTertiary">
                {rec.rationale}
              </AppText>
            ) : null}
          </Card>
        ))
      )}
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
  header: { gap: Spacing.xs, marginBottom: Spacing.xxl },
  linkRow: { gap: Spacing.sm, marginBottom: Spacing.xl },
  macroCard: { gap: Spacing.sm, marginBottom: Spacing.xl },
  fallbackCard: { gap: Spacing.sm, marginBottom: Spacing.lg },
  questionRow: { gap: Spacing.sm, marginBottom: Spacing.md },
  questionChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 999,
    backgroundColor: LiftFlowColors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.border,
  },
  answerCard: { marginBottom: Spacing.xl },
  recCard: { gap: Spacing.sm, marginBottom: Spacing.md },
  actionCard: { gap: Spacing.sm, marginBottom: Spacing.xl },
  workoutPreview: { marginTop: Spacing.sm, lineHeight: 18 },
});
