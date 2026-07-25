import { ageYearsFromDateOfBirth } from './ageAdjustments.js';
import { localDateString, resolveTimeZone } from './localDate.js';
import { addDays } from './programTypes.js';
import { requireAdmin } from './supabase.js';
import { resolveRankedGoals, toNutritionGoal } from './trainingGoals.js';
import { inferWorkoutType, type NutritionContext } from './workoutAwareNutrition.js';

export type SessionKind = 'strength' | 'cardio' | 'mobility';

export type ScheduledWorkout = {
  id: string;
  date: string;
  name: string;
  status: string;
  muscleGroups: string[];
  sessionKind?: SessionKind;
  rationale?: string;
};

/**
 * Everything `calculateMacroTargets` needs for one user on one local day, loaded once so the
 * dashboard, /adaptive-targets and the coach context cannot disagree about a user's targets.
 */
export type DailyMacroInputs = {
  userId: string;
  timeZone: string;
  today: string;
  weekEnd: string;
  goal: NutritionContext['goal'];
  rankedGoals: string[];
  bodyWeightKg?: number;
  profileWeightKg?: number;
  ageYears: number | null;
  dietaryStyle: NonNullable<NutritionContext['dietaryStyle']>;
  preferredWeightUnit: 'lb' | 'kg';
  metadata: Record<string, unknown>;
  /** Sum of `total_volume` over completed sessions in the trailing 7 days. */
  trainingVolume7d: number;
  /**
   * Weekly-equivalent volume over the 28 days *before* the trailing week. Used as the user's
   * own baseline so volume adjustments are relative to their history, not an absolute constant.
   */
  trainingVolumeBaseline7d: number;
  /** Today's session whatever its state — a completed workout is still a training day. */
  todaysWorkout?: ScheduledWorkout;
  /** Today through today+6, excluding cancelled, so each forecast day uses its own split. */
  weekWorkouts: ScheduledWorkout[];
  nextWorkout?: ScheduledWorkout;
};

const DIETARY_STYLES = new Set([
  'high_protein',
  'low_carb',
  'keto',
  'mediterranean',
  'vegetarian',
  'balanced',
]);

function toDietaryStyle(value: unknown): NonNullable<NutritionContext['dietaryStyle']> {
  return typeof value === 'string' && DIETARY_STYLES.has(value)
    ? (value as NonNullable<NutritionContext['dietaryStyle']>)
    : 'balanced';
}

/** A completed or in-progress session counts as training; only cancellation makes it a rest day. */
const NON_TRAINING_STATUSES = new Set(['cancelled', 'skipped']);

function toScheduledWorkout(row: {
  id: string;
  name: string;
  scheduled_date: string;
  status: string | null;
  suggested_muscle_groups: string[] | null;
  ai_rationale?: string | null;
  metadata?: unknown;
}): ScheduledWorkout {
  return {
    id: row.id,
    date: row.scheduled_date,
    name: row.name,
    status: row.status ?? 'planned',
    muscleGroups: row.suggested_muscle_groups ?? [],
    sessionKind: (row.metadata as { sessionKind?: SessionKind } | null)?.sessionKind,
    rationale: row.ai_rationale ?? undefined,
  };
}

/**
 * Today's local calendar day for one user. Callers that only need the date must not compute it
 * in UTC — that rolls over at the wrong moment for everyone outside UTC.
 */
export async function loadUserToday(userId: string): Promise<{ today: string; timeZone: string }> {
  const { data } = await requireAdmin().from('profiles').select('timezone').eq('id', userId).maybeSingle();
  const timeZone = resolveTimeZone(data?.timezone as string | null | undefined);
  return { today: localDateString(new Date(), timeZone), timeZone };
}

export async function loadDailyMacroInputs(userId: string): Promise<DailyMacroInputs> {
  const db = requireAdmin();

  const { data: profile } = await db
    .from('profiles')
    .select(
      'weight_kg, primary_training_goal, fitness_goals, date_of_birth, metadata, timezone, preferred_weight_unit',
    )
    .eq('id', userId)
    .maybeSingle();

  const timeZone = resolveTimeZone(profile?.timezone as string | null | undefined);
  const today = localDateString(new Date(), timeZone);
  const weekEnd = addDays(today, 6);
  const volumeWindowStart = addDays(today, -34);
  const recentWindowStart = addDays(today, -6);

  const [sessionsRes, scheduledRes] = await Promise.all([
    db
      .from('workout_sessions')
      .select('total_volume, started_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('started_at', `${volumeWindowStart}T00:00:00.000Z`),
    db
      .from('planned_workouts')
      .select('id, name, scheduled_date, status, suggested_muscle_groups, ai_rationale, metadata')
      .eq('user_id', userId)
      .gte('scheduled_date', today)
      .lte('scheduled_date', weekEnd)
      .order('scheduled_date', { ascending: true }),
  ]);

  let trainingVolume7d = 0;
  let priorVolume28d = 0;
  for (const session of sessionsRes.data ?? []) {
    const volume = Number(session.total_volume ?? 0);
    if (!Number.isFinite(volume) || volume <= 0) continue;
    const day = String(session.started_at ?? '').slice(0, 10);
    if (day >= recentWindowStart) trainingVolume7d += volume;
    else priorVolume28d += volume;
  }

  const weekWorkouts = (scheduledRes.data ?? [])
    .filter((row) => !NON_TRAINING_STATUSES.has(row.status ?? 'planned'))
    .map(toScheduledWorkout);

  const ranked = resolveRankedGoals(profile?.fitness_goals, profile?.primary_training_goal);
  const metadata = (profile?.metadata ?? {}) as Record<string, unknown>;
  const profileWeightKg = profile?.weight_kg != null ? Number(profile.weight_kg) : undefined;

  return {
    userId,
    timeZone,
    today,
    weekEnd,
    goal: toNutritionGoal(ranked[0]),
    rankedGoals: ranked,
    bodyWeightKg: profileWeightKg,
    profileWeightKg,
    ageYears: ageYearsFromDateOfBirth(profile?.date_of_birth),
    dietaryStyle: toDietaryStyle(metadata.dietaryStyle),
    preferredWeightUnit: profile?.preferred_weight_unit === 'kg' ? 'kg' : 'lb',
    metadata,
    trainingVolume7d,
    trainingVolumeBaseline7d: priorVolume28d / 4,
    todaysWorkout: weekWorkouts.find((w) => w.date === today),
    weekWorkouts,
    nextWorkout: weekWorkouts[0],
  };
}

/** Resolve the macro-shaping workout type for one scheduled session. */
export function workoutTypeFor(workout: ScheduledWorkout | undefined): NutritionContext['workoutType'] {
  if (!workout) return 'rest';
  if (workout.sessionKind === 'cardio') return 'cardio';
  if (workout.sessionKind === 'mobility') return 'rest';
  return workout.muscleGroups.length ? inferWorkoutType(workout.muscleGroups) : 'full';
}

/**
 * The one place a `NutritionContext` is assembled. Callers override only the fields they hold
 * fresher data for (recovery comes from the recovery engine, weight from the trend series).
 */
export function macroContextFrom(
  inputs: DailyMacroInputs,
  overrides: {
    recoveryScore?: number;
    recoveryModeActive?: boolean;
    bodyWeightKg?: number;
    dietaryStyle?: NutritionContext['dietaryStyle'];
    workout?: ScheduledWorkout;
    isTrainingDay?: boolean;
  } = {},
): NutritionContext {
  const workout = 'workout' in overrides ? overrides.workout : inputs.todaysWorkout;
  const isTrainingDay = overrides.isTrainingDay ?? !!workout;

  return {
    goal: inputs.goal,
    bodyWeightKg: overrides.bodyWeightKg ?? inputs.bodyWeightKg,
    ageYears: inputs.ageYears,
    recoveryScore: overrides.recoveryScore,
    recoveryModeActive: overrides.recoveryModeActive,
    trainingVolume: inputs.trainingVolume7d,
    trainingVolumeBaseline: inputs.trainingVolumeBaseline7d,
    workoutType: isTrainingDay ? workoutTypeFor(workout) : 'rest',
    sessionKind: isTrainingDay ? workout?.sessionKind : undefined,
    isTrainingDay,
    dietaryStyle: overrides.dietaryStyle ?? inputs.dietaryStyle,
  };
}
