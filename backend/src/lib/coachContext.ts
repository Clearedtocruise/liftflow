import type { LimitationContext } from './exerciseSubstitution.js';
import { parseLimitationFromVoice } from './exerciseSubstitution.js';
import { getProgramDashboard } from './programEngine.js';
import { calculateRecoveryScore, mergeTrainingLoadScore } from './recoveryScore.js';
import { requireAdmin } from './supabase.js';
import { resolveRankedGoals, toNutritionGoal } from './trainingGoals.js';
import { calculateMacroTargets, inferWorkoutType } from './workoutAwareNutrition.js';

export type CoachContext = {
  recovery: {
    score?: number;
    recommendation?: string;
    recoveryModeActive?: boolean;
    latestCheckIn?: Record<string, unknown>;
  };
  limitations: LimitationContext[];
  recentWorkouts: Array<{ name: string; date: string; volume: number; sets: number }>;
  lastPerformance: Array<{ exercise: string; weight: number; reps: number; date: string }>;
  nutrition: { caloriesTarget?: number; proteinTarget?: number; caloriesToday?: number; proteinToday?: number };
  plannedWorkout?: { name: string; muscleGroups: string[]; rationale?: string };
  weeklyCheckIn?: Record<string, unknown>;
  macroTargets?: ReturnType<typeof calculateMacroTargets>;
  program?: {
    name: string;
    currentWeek: number;
    completionPct: number;
    phaseName?: string;
    sprintPhase?: string;
    nextWorkout?: string;
    programType?: string;
  };
};

export async function loadCoachContext(userId: string): Promise<CoachContext> {
  const db = requireAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const [
    recoveryRow,
    limitations,
    recentSessions,
    lastSets,
    goals,
    todayMeals,
    plannedToday,
    weeklyCheckIn,
    profile,
  ] = await Promise.all([
    db
      .from('recovery_assessments')
      .select('*')
      .eq('user_id', userId)
      .eq('check_in_date', today)
      .maybeSingle(),
    db.from('training_limitations').select('*').eq('user_id', userId).eq('is_active', true),
    db
      .from('workout_sessions')
      .select('name, started_at, total_volume, total_sets')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('started_at', { ascending: false })
      .limit(5),
    db
      .from('workout_sets')
      .select('weight, reps, logged_at, workout_exercises!inner(exercises(name), workout_sessions!inner(user_id))')
      .eq('workout_exercises.workout_sessions.user_id', userId)
      .order('logged_at', { ascending: false })
      .limit(10),
    db.from('nutrition_goals').select('*').eq('user_id', userId).eq('is_active', true).limit(1).maybeSingle(),
    db.from('meals').select('calories, protein_g').eq('user_id', userId).eq('scheduled_date', today),
    db
      .from('planned_workouts')
      .select('*')
      .eq('user_id', userId)
      .eq('scheduled_date', today)
      .neq('status', 'cancelled')
      .limit(1)
      .maybeSingle(),
    db
      .from('weekly_coach_check_ins')
      .select('*')
      .eq('user_id', userId)
      .order('week_start_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from('profiles').select('weight_kg, primary_training_goal, fitness_goals, date_of_birth').eq('id', userId).maybeSingle(),
  ]);

  const limitationContexts: LimitationContext[] = (limitations.data ?? []).map((row) => ({
    bodyArea: row.body_area,
    limitationType: row.limitation_type,
    painScore: row.pain_score ?? undefined,
    affectedMovements: row.affected_movements ?? [],
    movementRestrictions: row.movement_restrictions ?? [],
  }));

  const recoveryScore = recoveryRow.data?.recovery_score ?? undefined;
  const muscleGroups = plannedToday.data?.suggested_muscle_groups ?? [];
  const workoutType = muscleGroups.length ? inferWorkoutType(muscleGroups) : 'rest';

  const rankedGoals = resolveRankedGoals(profile.data?.fitness_goals, profile.data?.primary_training_goal);

  const macroTargets = calculateMacroTargets({
    goal: toNutritionGoal(rankedGoals[0]),
    bodyWeightKg: profile.data?.weight_kg ?? undefined,
    recoveryScore,
    recoveryModeActive: recoveryRow.data?.recovery_mode_active ?? false,
    workoutType,
    isTrainingDay: !!plannedToday.data,
    dietaryStyle: 'balanced',
  });

  // Never let dashboard/regen load block meal-plan or coach replies.
  let programDashboard: Awaited<ReturnType<typeof getProgramDashboard>> = null;
  try {
    programDashboard = await getProgramDashboard(userId);
  } catch {
    programDashboard = null;
  }

  return {
    recovery: {
      score: recoveryScore,
      recommendation: recoveryRow.data?.daily_recommendation ?? undefined,
      recoveryModeActive: recoveryRow.data?.recovery_mode_active ?? false,
      latestCheckIn: recoveryRow.data ?? undefined,
    },
    limitations: limitationContexts,
    recentWorkouts: (recentSessions.data ?? []).map((s) => ({
      name: s.name,
      date: s.started_at,
      volume: Number(s.total_volume ?? 0),
      sets: Number(s.total_sets ?? 0),
    })),
    lastPerformance: (lastSets.data ?? []).slice(0, 5).map((row) => ({
      exercise:
        (row as { workout_exercises?: { exercises?: { name?: string } } }).workout_exercises?.exercises?.name ??
        'Exercise',
      weight: Number(row.weight ?? 0),
      reps: Number(row.reps ?? 0),
      date: row.logged_at,
    })),
    nutrition: {
      caloriesTarget: goals.data?.daily_calories ?? macroTargets.calories,
      proteinTarget: goals.data?.protein_g ?? macroTargets.proteinG,
      caloriesToday: (todayMeals.data ?? []).reduce((s, m) => s + Number(m.calories ?? 0), 0),
      proteinToday: (todayMeals.data ?? []).reduce((s, m) => s + Number(m.protein_g ?? 0), 0),
    },
    plannedWorkout: plannedToday.data
      ? {
          name: plannedToday.data.name,
          muscleGroups: plannedToday.data.suggested_muscle_groups ?? [],
          rationale: plannedToday.data.ai_rationale ?? undefined,
        }
      : undefined,
    weeklyCheckIn: weeklyCheckIn.data ?? undefined,
    macroTargets,
    program: programDashboard
      ? {
          name: programDashboard.program.name as string,
          currentWeek: programDashboard.currentWeek,
          completionPct: programDashboard.completionPct,
          phaseName: (programDashboard.phase?.name as string | undefined) ?? undefined,
          sprintPhase: ((programDashboard.phase?.metadata as { sprintPhase?: string })?.sprintPhase) ?? undefined,
          nextWorkout: (programDashboard.nextWorkout?.name as string | undefined) ?? undefined,
          programType: ((programDashboard.program.metadata as { programType?: string })?.programType) ?? undefined,
        }
      : undefined,
  };
}

export function answerSmartCoachQuestion(message: string, ctx: CoachContext): string | null {
  const q = message.toLowerCase().trim();

  if (/what weight|how much weight|what should i lift/.test(q)) {
    const last = ctx.lastPerformance[0];
    if (!last) return 'No recent sets logged — start conservative and add weight when reps feel solid.';
    return `Last ${last.exercise}: ${last.weight} lb × ${last.reps}. Try ${last.weight + 5} lb if you hit the top of your rep range last session.`;
  }

  if (/last time|what did i do|previous/.test(q)) {
    const last = ctx.lastPerformance[0];
    if (!last) return 'No logged history yet for this movement — log your first set to unlock progression tracking.';
    return `Last session for ${last.exercise}: ${last.weight} lb × ${last.reps} on ${new Date(last.date).toLocaleDateString()}.`;
  }

  if (/why.*exercise|why.*choose|why this/.test(q)) {
    if (ctx.limitations.length > 0) {
      return `Exercise selection accounts for your active ${ctx.limitations[0].bodyArea} limitation — substitutions reduce stress on affected movements. This is not medical advice.`;
    }
    return ctx.plannedWorkout?.rationale ?? 'Exercises rotate based on your equipment, recent training, and muscle group balance.';
  }

  if (/eat after|post workout|after this workout/.test(q)) {
    const protein = ctx.macroTargets?.proteinG ?? ctx.nutrition.proteinTarget ?? 180;
    return `Post-workout: aim for 25–40g protein within 2 hours. Today's protein target is ~${protein}g total. ${ctx.macroTargets?.rationale ?? ''}`;
  }

  if (/recovery day|why.*recovery/.test(q)) {
    if (ctx.recovery.recoveryModeActive) {
      return `Recovery Mode is active (score ${ctx.recovery.score ?? 'low'}). ${ctx.recovery.recommendation ?? 'Prioritize sleep, mobility, and lighter training.'}`;
    }
    return ctx.recovery.recommendation ?? 'Recovery looks manageable — train as planned with good sleep and nutrition.';
  }

  if (/calories change|why.*calories/.test(q)) {
    return ctx.macroTargets?.rationale ?? 'Calories adjust based on your goal, body weight, training day type, and recovery score.';
  }

  if (/workout change|why.*change|why.*different/.test(q)) {
    if (ctx.recovery.recoveryModeActive) {
      return 'Your workout changed because Recovery Mode is active — volume and intensity are reduced to match your recovery score.';
    }
    if (ctx.limitations.length > 0) {
      return `Exercises were substituted due to your ${ctx.limitations[0].bodyArea} limitation while keeping the same training focus.`;
    }
    return 'Workouts adapt weekly based on your program phase, progression history, and equipment — not random daily generation.';
  }

  if (/why.*deload|deload/.test(q)) {
    const phase = ctx.program?.sprintPhase;
    if (phase === 'deload') {
      return `You're in a deload phase (week ${ctx.program?.currentWeek ?? ''}) to dissipate fatigue before the next intensification block.`;
    }
    return 'Deload phases are scheduled automatically when training load accumulates or recovery/compliance drops.';
  }

  if (/next phase|what phase/.test(q)) {
    const phase = ctx.program?.sprintPhase ?? 'accumulation';
    const order = ['accumulation', 'intensification', 'deload', 'peak', 'recovery'];
    const idx = order.indexOf(phase);
    const next = order[idx + 1] ?? 'recovery';
    return `Current phase: ${phase}. Typical progression moves toward ${next} based on your program week and compliance.`;
  }

  if (/next workout|what.*today/.test(q)) {
    if (ctx.program?.nextWorkout) return `Next scheduled workout: ${ctx.program.nextWorkout} (Week ${ctx.program.currentWeek}).`;
    return ctx.plannedWorkout?.name ? `Today's plan: ${ctx.plannedWorkout.name}.` : 'No workout scheduled — check your program calendar.';
  }

  if (/substitut|swap|replace/.test(q)) {
    if (ctx.limitations.length === 0) return 'No active limitations on file — exercises are selected from your standard rotation.';
    const lim = ctx.limitations[0];
    return `Because of your ${lim.bodyArea} ${lim.limitationType}, pressing or loading patterns may be swapped for joint-friendly alternatives. I cannot diagnose injuries — consult a clinician for pain.`;
  }

  const parsedLimitation = parseLimitationFromVoice(message);
  if (parsedLimitation?.bodyArea && /hurt|pain|ache|sore|tight|limit/.test(q)) {
    return `Noted ${parsedLimitation.bodyArea} ${parsedLimitation.limitationType}. Log this under Limitations — I'll suggest exercise swaps and may reduce intensity. This is not a diagnosis.`;
  }

  return null;
}

export { calculateRecoveryScore, mergeTrainingLoadScore };
