import { answerSmartCoachQuestion, loadCoachContext } from './coachContext.js';
import { buildReferenceStyleWorkoutPlan, LIFTING_AI_SYSTEM_PROMPT, SPLIT_VOLUME_TARGETS, splitKeyFromLabel } from './liftingReference/index.js';
import { loadRecoveryIntelligence } from './loadRecoveryIntelligence.js';
import { localDateString, weekStartFromDateString } from './localDate.js';
import { generateWeeklyMealPlanMeals } from './mealPlanTemplates.js';
import { getOpenAI, hasOpenAI } from './openai.js';
import { requireAdmin } from './supabase.js';
import {
    buildAdaptiveWorkoutPlan,
    filterExerciseLibraryForPrompt,
    loadAvailableExercises,
    loadUserTrainingProfile,
    type GeneratedWorkoutPlan,
} from './workoutPlanner.js';

const MUSCLE_GROUPS = ['chest', 'back', 'shoulders', 'legs', 'arms', 'core'] as const;

export async function suggestMuscleGroups(userId: string) {
  const db = requireAdmin();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data: sessions } = await db
    .from('workout_sessions')
    .select('started_at, workout_exercises(exercises(muscle_groups))')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gte('started_at', weekAgo.toISOString());

  const trained = new Map<string, number>();
  for (const session of sessions ?? []) {
    for (const we of (session as { workout_exercises?: { exercises?: { muscle_groups?: string[] } }[] }).workout_exercises ?? []) {
      for (const mg of we.exercises?.muscle_groups ?? []) {
        trained.set(mg, (trained.get(mg) ?? 0) + 1);
      }
    }
  }

  const untrained = MUSCLE_GROUPS.filter((g) => !trained.has(g) || (trained.get(g) ?? 0) < 1);
  const primaryGroups = untrained.length > 0 ? untrained.slice(0, 2) : ['legs', 'back'];

  return {
    primaryGroups,
    secondaryGroups: MUSCLE_GROUPS.filter((g) => !primaryGroups.includes(g)).slice(0, 2),
    rationale: untrained.length > 0
      ? `Recovery window suggests training ${primaryGroups.join(' and ')} — least volume this week.`
      : 'Balanced rotation — prioritize compound movements for legs and back.',
    recoveryScore: untrained.length > 2 ? 85 : 65,
  };
}

export async function assessRecovery(userId: string) {
  const report = await loadRecoveryIntelligence(userId);

  const legacyStatus =
    report.recoveryStatus === 'fully_recovered'
      ? 'optimal'
      : report.recoveryStatus === 'recovering'
        ? 'moderate'
        : report.recoveryStatus === 'fatigued'
          ? 'fatigued'
          : 'overreached';

  return {
    status: legacyStatus,
    assessedAt: report.assessedAt,
    sleepHours: report.factors.sleepHours,
    sorenessScore: report.factors.sorenessLevel ?? (report.recoveryScore < 60 ? 6 : 4),
    energyScore: Math.round(report.factors.subjectiveScore / 10),
    muscleGroups: report.suggestedMuscleGroups,
    recoveryScore: report.recoveryScore,
    recoveryStatus: report.recoveryStatus,
    recoveryStatusLabel: report.recoveryStatusLabel,
    trainingRecommendation: report.trainingRecommendation,
    trainingRecommendationLabel: report.trainingRecommendationLabel,
    aiAnalysis: report.rationale,
    recommendations: [report.trainingRecommendationLabel],
    intelligence: report,
  };
}

export async function generateRecommendations(userId: string) {
  const muscles = await suggestMuscleGroups(userId);
  const recovery = await assessRecovery(userId);

  const recommendations: Array<{
    recommendationType: string;
    title: string;
    description: string;
    rationale: string;
    payload: Record<string, unknown>;
    confidence: number;
  }> = [
    {
      recommendationType: 'muscle_group',
      title: `Train ${muscles.primaryGroups.join(' & ')}`,
      description: muscles.rationale,
      rationale: 'Based on weekly muscle group volume and recovery windows.',
      payload: { groups: muscles.primaryGroups },
      confidence: 0.88,
    },
    {
      recommendationType: recovery.status === 'fatigued' ? 'recovery' : 'workout',
      title: recovery.status === 'fatigued' ? 'Schedule a recovery day' : 'Increase workout intensity',
      description: recovery.aiAnalysis,
      rationale: 'Derived from recent session count and total volume.',
      payload: { recoveryStatus: recovery.status },
      confidence: 0.82,
    },
  ];

  const db = requireAdmin();
  const { data: goals } = await db.from('nutrition_goals').select('*').eq('user_id', userId).eq('is_active', true).limit(1).maybeSingle();
  const { data: todayMeals } = await db
    .from('meals')
    .select('protein_g, calories')
    .eq('user_id', userId)
    .eq('scheduled_date', new Date().toISOString().slice(0, 10));

  const proteinToday = (todayMeals ?? []).reduce((s, m) => s + Number(m.protein_g ?? 0), 0);
  const proteinTarget = goals?.protein_g ?? 180;

  if (proteinToday < proteinTarget * 0.5 && (await sessionCount(userId))) {
    recommendations.push({
      recommendationType: 'nutrition',
      title: 'Increase protein intake',
      description: `You've logged ${Math.round(proteinToday)}g protein today. Target is ${proteinTarget}g — add a post-workout protein source.`,
      rationale: 'Protein supports recovery after training sessions.',
      payload: { proteinToday, proteinTarget },
      confidence: 0.9,
    });
  }

  if (hasOpenAI()) {
    const openai = getOpenAI()!;
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an evidence-based strength coach. Return one JSON object: { "weeklySchedule": string[], "intensityAdvice": string }',
        },
        {
          role: 'user',
          content: JSON.stringify({ muscles, recovery, proteinToday, proteinTarget }),
        },
      ],
      response_format: { type: 'json_object' },
    });

    try {
      const extra = JSON.parse(completion.choices[0]?.message?.content ?? '{}');
      if (extra.weeklySchedule) {
        recommendations.push({
          recommendationType: 'training_phase',
          title: 'Suggested weekly schedule',
          description: extra.weeklySchedule.join(' · '),
          rationale: extra.intensityAdvice ?? 'AI-generated based on your training load.',
          payload: { schedule: extra.weeklySchedule },
          confidence: 0.75,
        });
      }
    } catch {
      // ignore parse errors
    }
  }

  return recommendations;
}

async function sessionCount(userId: string): Promise<boolean> {
  const db = requireAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const { count } = await db
    .from('workout_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('started_at', `${today}T00:00:00`);
  return (count ?? 0) > 0;
}

export async function coachResponse(context: string, message: string, userId: string) {
  const coachCtx = await loadCoachContext(userId);
  const smartAnswer = answerSmartCoachQuestion(message, coachCtx);
  const recovery = await assessRecovery(userId);
  const muscles = await suggestMuscleGroups(userId);

  if (smartAnswer && !hasOpenAI()) {
    return {
      response: `${smartAnswer} (Not medical advice — consult a professional for injury or pain.)`,
      citations: [],
      modelVersion: 'heuristic-v2',
    };
  }

  if (hasOpenAI()) {
    const openai = getOpenAI()!;
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are LiftFlow AI coach. Give concise, evidence-based fitness advice. Use workout history, recovery score, limitations, and nutrition data. NEVER diagnose medical conditions. Recommend consulting clinicians for injury/pain.',
        },
        {
          role: 'user',
          content: `Context: ${context}. Coach data: ${JSON.stringify(coachCtx)}. Recovery: ${JSON.stringify(recovery)}. Muscles: ${JSON.stringify(muscles)}. Question: ${message}${smartAnswer ? `. Heuristic hint: ${smartAnswer}` : ''}`,
        },
      ],
    });

    return {
      response: completion.choices[0]?.message?.content ?? smartAnswer ?? 'Continue with your planned training.',
      citations: [],
      modelVersion: 'gpt-4o-mini',
      tokensUsed: completion.usage?.total_tokens,
    };
  }

  return {
    response: smartAnswer ?? `${recovery.aiAnalysis} Suggested focus: ${muscles.primaryGroups.join(', ')}.`,
    citations: [],
    modelVersion: 'heuristic-v2',
  };
}

export function generateWeeklyMealPlan(proteinG = 180, calories = 2400, dietaryStyle: 'balanced' | 'high_protein' | 'low_carb' | 'keto' | 'mediterranean' | 'vegetarian' = 'balanced') {
  const weekStart = weekStartFromDateString(localDateString());
  const meals = generateWeeklyMealPlanMeals(proteinG, calories, dietaryStyle, weekStart);

  return {
    name: 'Weekly Meal Plan',
    weekStartDate: weekStart,
    aiGenerated: true,
    aiRationale: `Balanced plan targeting ~${calories} kcal and ${proteinG}g protein daily with rotating meals across the week.`,
    meals,
  };
}

export type { GeneratedWorkoutExercise, GeneratedWorkoutPlan } from './workoutPlanner.js';

export async function generateWorkoutPlan(userId: string): Promise<GeneratedWorkoutPlan> {
  const muscles = await suggestMuscleGroups(userId);
  const recovery = await assessRecovery(userId);
  const profile = await loadUserTrainingProfile(userId);
  const availableExercises = await loadAvailableExercises(userId);
  const heuristicPlan = await buildAdaptiveWorkoutPlan(userId, muscles.primaryGroups, muscles.rationale);

  if (availableExercises.length === 0) {
    return {
      ...heuristicPlan,
      rationale: `${recovery.aiAnalysis} ${heuristicPlan.rationale}`,
    };
  }

  if (!hasOpenAI()) {
    return {
      ...heuristicPlan,
      rationale: `${recovery.aiAnalysis} ${heuristicPlan.rationale}`,
    };
  }

  const allowedNames = new Set(availableExercises.map((e) => e.name.toLowerCase()));
  const exerciseList = filterExerciseLibraryForPrompt(availableExercises);
  const volumeHint = inferVolumeHint(muscles.primaryGroups, heuristicPlan);

  const openai = getOpenAI()!;
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `${LIFTING_AI_SYSTEM_PROMPT}\n\nReturn JSON: { "name": string, "rationale": string, "muscleGroups": string[], "estimatedMinutes": number, "exercises": [{ "name": string, "sets": number, "reps": string, "weightLbs": number, "restSeconds": number, "notes": string, "supersetGroupId": string }] }. CRITICAL: Use ONLY exercise names from the provided library (exact names). Primary goal: ${profile.primaryTrainingGoal}. Experience: ${profile.trainingExperience ?? 'intermediate'}.`,
      },
      {
        role: 'user',
        content: JSON.stringify({
          targetMuscles: muscles.primaryGroups,
          volumeTargets: volumeHint,
          recovery: recovery.status,
          recoveryAdvice: recovery.aiAnalysis,
          trainingGoal: profile.primaryTrainingGoal,
          fitnessGoals: profile.fitnessGoals,
          trainingLocation: profile.trainingLocation,
          availableEquipment: profile.availableEquipment,
          exerciseLibrary: exerciseList,
          suggestedRotation: heuristicPlan.exercises.map((e) => e.name),
          bodyWeightKg: profile.weightKg,
        }),
      },
    ],
    response_format: { type: 'json_object' },
  });

  try {
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? '{}') as GeneratedWorkoutPlan;
    const filtered =
      parsed.exercises?.filter((e) => allowedNames.has(e.name.toLowerCase())) ?? [];

    if (filtered.length >= 3) {
      return {
        name: parsed.name ?? heuristicPlan.name,
        rationale: parsed.rationale ?? heuristicPlan.rationale,
        muscleGroups: parsed.muscleGroups ?? muscles.primaryGroups,
        exercises: filtered.map((exercise, index) => ({
          ...exercise,
          ...(heuristicPlan.exercises[index]?.weightLbs && !exercise.weightLbs
            ? { weightLbs: heuristicPlan.exercises[index].weightLbs }
            : {}),
          ...(heuristicPlan.exercises[index]?.notes && !exercise.notes
            ? { notes: heuristicPlan.exercises[index].notes }
            : {}),
        })),
        estimatedMinutes: parsed.estimatedMinutes ?? heuristicPlan.estimatedMinutes,
        aiGenerated: true,
      };
    }
  } catch {
    // fall through
  }

  return {
    ...heuristicPlan,
    aiGenerated: true,
    rationale: `${recovery.aiAnalysis} ${heuristicPlan.rationale}`,
  };
}

export async function synthesizeSpeech(text: string): Promise<Buffer | null> {
  if (!hasOpenAI()) return null;
  const openai = getOpenAI()!;
  const trimmed = text.slice(0, 4096);
  const mp3 = await openai.audio.speech.create({
    model: 'tts-1',
    voice: 'nova',
    input: trimmed,
  });
  return Buffer.from(await mp3.arrayBuffer());
}

function inferVolumeHint(primaryGroups: string[], heuristicPlan: GeneratedWorkoutPlan): Record<string, number> | null {
  const slotLabel = heuristicPlan.name ?? '';
  const splitKey =
    splitKeyFromLabel(slotLabel) ??
    (primaryGroups.includes('chest') && primaryGroups.includes('shoulders')
      ? 'chest_shoulders_triceps'
      : primaryGroups.includes('back') && primaryGroups.includes('biceps')
        ? 'back_biceps_core'
        : primaryGroups.some((g) => ['quads', 'hamstrings', 'glutes'].includes(g))
          ? 'legs_core'
          : null);

  if (!splitKey) return null;
  return { ...SPLIT_VOLUME_TARGETS[splitKey] };
}
