import { getOpenAI, hasOpenAI } from './openai.js';
import { requireAdmin } from './supabase.js';

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
  const db = requireAdmin();
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const { data: recent } = await db
    .from('workout_sessions')
    .select('started_at, total_volume, total_sets')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gte('started_at', threeDaysAgo.toISOString());

  const sessionCount = recent?.length ?? 0;
  const totalVolume = (recent ?? []).reduce((s, r) => s + Number(r.total_volume ?? 0), 0);

  let status: 'optimal' | 'moderate' | 'fatigued' | 'overreached' | 'unknown' = 'optimal';
  if (sessionCount >= 4 || totalVolume > 50000) status = 'fatigued';
  else if (sessionCount >= 3) status = 'moderate';
  else if (sessionCount === 0) status = 'optimal';

  return {
    status,
    assessedAt: new Date().toISOString(),
    sleepHours: undefined,
    sorenessScore: sessionCount >= 4 ? 7 : 4,
    energyScore: sessionCount >= 4 ? 5 : 8,
    muscleGroups: [],
    aiAnalysis: sessionCount >= 4
      ? 'High training load in last 72 hours. Recommend a recovery day or light mobility work.'
      : 'Training load is manageable. Good window for progressive overload.',
    recommendations: status === 'fatigued' ? ['Take a rest day', 'Focus on sleep and protein'] : ['Train as planned'],
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
  const recovery = await assessRecovery(userId);
  const muscles = await suggestMuscleGroups(userId);

  if (hasOpenAI()) {
    const openai = getOpenAI()!;
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are LiftFlow AI coach. Give concise, evidence-based fitness advice. Reference recovery and muscle group data when relevant.',
        },
        {
          role: 'user',
          content: `Context: ${context}. Recovery: ${JSON.stringify(recovery)}. Muscles: ${JSON.stringify(muscles)}. Question: ${message}`,
        },
      ],
    });

    return {
      response: completion.choices[0]?.message?.content ?? 'Continue with your planned training.',
      citations: [],
      modelVersion: 'gpt-4o-mini',
      tokensUsed: completion.usage?.total_tokens,
    };
  }

  return {
    response: `${recovery.aiAnalysis} Suggested focus: ${muscles.primaryGroups.join(', ')}.`,
    citations: [],
    modelVersion: 'heuristic-v1',
  };
}

export function generateWeeklyMealPlan(proteinG = 180, calories = 2400) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const templates = [
    { type: 'breakfast', name: 'Greek yogurt bowl with berries', calories: 450, proteinG: 35, carbsG: 45, fatG: 12 },
    { type: 'lunch', name: 'Grilled chicken rice bowl', calories: 650, proteinG: 50, carbsG: 60, fatG: 15 },
    { type: 'dinner', name: 'Salmon with roasted vegetables', calories: 700, proteinG: 45, carbsG: 35, fatG: 28 },
    { type: 'snack', name: 'Protein shake with banana', calories: 300, proteinG: 30, carbsG: 30, fatG: 5 },
  ];

  const start = new Date();
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1);
  start.setDate(diff);

  const meals = days.flatMap((_, dayIndex) => {
    const date = new Date(start);
    date.setDate(start.getDate() + dayIndex);
    const dateStr = date.toISOString().slice(0, 10);
    return templates.map((t) => ({
      mealType: t.type,
      name: t.name,
      scheduledDate: dateStr,
      calories: Math.round(t.calories * (calories / 2400)),
      proteinG: Math.round(t.proteinG * (proteinG / 180)),
      carbsG: t.carbsG,
      fatG: t.fatG,
    }));
  });

  return {
    name: 'Weekly Meal Plan',
    weekStartDate: start.toISOString().slice(0, 10),
    aiGenerated: true,
    aiRationale: `Balanced plan targeting ~${calories} kcal and ${proteinG}g protein daily.`,
    meals,
  };
}

export type GeneratedWorkoutExercise = {
  name: string;
  sets: number;
  reps: string;
  weightLbs?: number;
  restSeconds: number;
  notes?: string;
};

export type GeneratedWorkoutPlan = {
  name: string;
  rationale: string;
  muscleGroups: string[];
  exercises: GeneratedWorkoutExercise[];
  estimatedMinutes: number;
  aiGenerated: boolean;
};

export async function generateWorkoutPlan(userId: string): Promise<GeneratedWorkoutPlan> {
  const db = requireAdmin();
  const muscles = await suggestMuscleGroups(userId);
  const recovery = await assessRecovery(userId);

  const { data: exercises } = await db
    .from('exercises')
    .select('name, muscle_groups, equipment')
    .eq('is_system', true)
    .limit(16);

  const { data: profile } = await db.from('profiles').select('training_experience, weight_kg').eq('id', userId).maybeSingle();

  const exerciseList = (exercises ?? []).map((e) => `${e.name} (${(e.muscle_groups ?? []).join(', ')})`).join('; ');
  const experience = profile?.training_experience ?? 'beginner';

  const basePlan: GeneratedWorkoutPlan = {
    name: `${muscles.primaryGroups.join(' & ')} Workout`,
    rationale: muscles.rationale,
    muscleGroups: muscles.primaryGroups,
    exercises: [
      { name: 'Barbell Bench Press', sets: 4, reps: '6-8', weightLbs: 135, restSeconds: 120 },
      { name: 'Barbell Row', sets: 4, reps: '8-10', weightLbs: 115, restSeconds: 90 },
      { name: 'Overhead Press', sets: 3, reps: '8-10', weightLbs: 65, restSeconds: 90 },
      { name: 'Romanian Deadlift', sets: 3, reps: '10-12', weightLbs: 135, restSeconds: 90 },
    ],
    estimatedMinutes: 55,
    aiGenerated: false,
  };

  if (!hasOpenAI()) {
    return { ...basePlan, rationale: `${recovery.aiAnalysis} ${muscles.rationale}` };
  }

  const openai = getOpenAI()!;
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are an expert strength coach. Return JSON: { "name": string, "rationale": string, "muscleGroups": string[], "estimatedMinutes": number, "exercises": [{ "name": string, "sets": number, "reps": string, "weightLbs": number, "restSeconds": number, "notes": string }] }. Use only exercises from the library when possible. Tailor to ${experience} level.`,
      },
      {
        role: 'user',
        content: JSON.stringify({
          targetMuscles: muscles.primaryGroups,
          recovery: recovery.status,
          recoveryAdvice: recovery.aiAnalysis,
          exerciseLibrary: exerciseList,
          bodyWeightKg: profile?.weight_kg,
        }),
      },
    ],
    response_format: { type: 'json_object' },
  });

  try {
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? '{}') as GeneratedWorkoutPlan;
    if (parsed.exercises?.length) {
      return {
        name: parsed.name ?? basePlan.name,
        rationale: parsed.rationale ?? muscles.rationale,
        muscleGroups: parsed.muscleGroups ?? muscles.primaryGroups,
        exercises: parsed.exercises,
        estimatedMinutes: parsed.estimatedMinutes ?? 55,
        aiGenerated: true,
      };
    }
  } catch {
    // fall through
  }

  return { ...basePlan, aiGenerated: true, rationale: muscles.rationale };
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
