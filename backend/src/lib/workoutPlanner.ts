import { expandEquipmentRequirements } from './equipmentCatalog.js';
import {
    applySubstitutionsToExercises,
    type LimitationContext,
} from './exerciseSubstitution.js';
import { requireAdmin } from './supabase.js';
import { blendWorkoutPreset, resolveRankedGoals, toPlannerGoal } from './trainingGoals.js';

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

export type TrainingGoal = 'fat_loss' | 'muscle_gain' | 'strength' | 'general_fitness';

export type ExerciseRecord = {
  id: string;
  name: string;
  slug: string;
  category: string;
  equipment: string;
  muscle_groups: string[];
  metadata: {
    requires?: string[];
    movement_family?: string;
  };
};

export type UserTrainingProfile = {
  trainingLocation?: string | null;
  availableEquipment: string[];
  primaryTrainingGoal: TrainingGoal;
  fitnessGoals: string[];
  trainingExperience?: string | null;
  weightKg?: number | null;
};

const ALL_EQUIPMENT = [
  'bodyweight',
  'bands',
  'dumbbells',
  'bench',
  'pull_up_bar',
  'barbell',
  'rack',
  'machines',
] as const;

const MUSCLE_TO_FAMILIES: Record<string, string[]> = {
  chest: ['horizontal_press'],
  back: ['horizontal_pull', 'vertical_pull'],
  shoulders: ['vertical_press', 'rear_delt'],
  legs: ['squat_pattern', 'hinge_pattern', 'lunge_pattern'],
  arms: ['biceps', 'triceps'],
  core: ['core'],
  quads: ['squat_pattern', 'lunge_pattern'],
  glutes: ['hinge_pattern', 'squat_pattern', 'lunge_pattern'],
  hamstrings: ['hinge_pattern', 'hamstrings'],
  biceps: ['biceps'],
  triceps: ['triceps'],
};

const GOAL_PRESETS: Record<
  TrainingGoal,
  { sets: number; reps: string; restSeconds: number; exerciseCount: number }
> = {
  fat_loss: { sets: 3, reps: '12-15', restSeconds: 45, exerciseCount: 10 },
  muscle_gain: { sets: 3, reps: '8-12', restSeconds: 90, exerciseCount: 10 },
  strength: { sets: 3, reps: '4-6', restSeconds: 150, exerciseCount: 10 },
  general_fitness: { sets: 3, reps: '10-12', restSeconds: 60, exerciseCount: 10 },
};

export const WORKOUT_MIN_EXERCISES = 4;
export const WORKOUT_MIN_SETS = 3;
export const WORKOUT_TARGET_EXERCISES = 10;
export const WORKOUT_TARGET_MINUTES = 60;

export function expandAvailableEquipment(raw: string[]): Set<string> {
  return expandEquipmentRequirements(raw);
}

export function exerciseMeetsEquipment(exercise: ExerciseRecord, available: Set<string>): boolean {
  const requires = exercise.metadata?.requires ?? [legacyEquipmentToRequirement(exercise.equipment)];
  return requires.every((req) => available.has(req));
}

function legacyEquipmentToRequirement(equipment: string): string {
  switch (equipment) {
    case 'dumbbell':
      return 'dumbbells';
    case 'machine':
    case 'cable':
      return 'machines';
    case 'barbell':
      return 'barbell';
    case 'bodyweight':
      return 'bodyweight';
    case 'bands':
      return 'bands';
    default:
      return equipment;
  }
}

export async function loadActiveLimitations(userId: string): Promise<LimitationContext[]> {
  const db = requireAdmin();
  const { data } = await db
    .from('training_limitations')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true);

  return (data ?? []).map((row) => ({
    bodyArea: row.body_area,
    limitationType: row.limitation_type,
    painScore: row.pain_score ?? undefined,
    affectedMovements: row.affected_movements ?? [],
    movementRestrictions: row.movement_restrictions ?? [],
  }));
}

export async function loadRecoveryModifiers(userId: string): Promise<{ volumeMultiplier: number; intensityMultiplier: number; recoveryModeActive: boolean }> {
  const db = requireAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await db
    .from('recovery_assessments')
    .select('recovery_score, recovery_mode_active, metadata')
    .eq('user_id', userId)
    .eq('check_in_date', today)
    .maybeSingle();

  if (!data) return { volumeMultiplier: 1, intensityMultiplier: 1, recoveryModeActive: false };

  const metadata = (data.metadata ?? {}) as { volumeMultiplier?: number; intensityMultiplier?: number };
  const score = data.recovery_score ?? 85;
  let volumeMultiplier = metadata.volumeMultiplier ?? 1;
  let intensityMultiplier = metadata.intensityMultiplier ?? 1;

  if (score < 40 || data.recovery_mode_active) {
    volumeMultiplier = Math.min(volumeMultiplier, 0.5);
    intensityMultiplier = Math.min(intensityMultiplier, 0.7);
  }

  return {
    volumeMultiplier,
    intensityMultiplier,
    recoveryModeActive: data.recovery_mode_active ?? false,
  };
}

export async function loadUserTrainingProfile(userId: string): Promise<UserTrainingProfile> {
  const db = requireAdmin();
  const { data } = await db
    .from('profiles')
    .select('training_location, available_equipment, primary_training_goal, fitness_goals, training_experience, weight_kg')
    .eq('id', userId)
    .maybeSingle();

  const ranked = resolveRankedGoals(data?.fitness_goals, data?.primary_training_goal);

  return {
    trainingLocation: data?.training_location,
    availableEquipment: data?.available_equipment?.length ? data.available_equipment : ['full_gym'],
    primaryTrainingGoal: toPlannerGoal(ranked[0]) as TrainingGoal,
    fitnessGoals: ranked,
    trainingExperience: data?.training_experience,
    weightKg: data?.weight_kg,
  };
}

export async function loadAvailableExercises(
  userId: string,
  equipmentOverride?: string[],
): Promise<ExerciseRecord[]> {
  const profile = await loadUserTrainingProfile(userId);
  const equipment =
    equipmentOverride?.length ? equipmentOverride : profile.availableEquipment;
  const available = expandAvailableEquipment(equipment);
  const db = requireAdmin();

  const { data } = await db
    .from('exercises')
    .select('id, name, slug, category, equipment, muscle_groups, metadata')
    .eq('is_system', true);

  let filtered = (data ?? [])
    .map((row) => ({
      ...row,
      metadata: (row.metadata ?? {}) as ExerciseRecord['metadata'],
    }))
    .filter((exercise) => exerciseMeetsEquipment(exercise, available));

  if (filtered.length < WORKOUT_TARGET_EXERCISES) {
    const expanded = expandAvailableEquipment([...equipment, 'bodyweight', 'bands', 'dumbbells']);
    const supplemental = (data ?? [])
      .map((row) => ({
        ...row,
        metadata: (row.metadata ?? {}) as ExerciseRecord['metadata'],
      }))
      .filter((exercise) => exerciseMeetsEquipment(exercise, expanded));

    const bySlug = new Map<string, ExerciseRecord>();
    for (const exercise of [...filtered, ...supplemental]) {
      bySlug.set(exercise.slug, exercise);
    }
    filtered = Array.from(bySlug.values());
  }

  return filtered;
}

export async function getRecentExerciseSlugs(userId: string, days = 21): Promise<Map<string, Date>> {
  const db = requireAdmin();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: sessions } = await db
    .from('workout_sessions')
    .select('started_at, workout_exercises(exercises(slug, name))')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gte('started_at', since.toISOString());

  const lastUsed = new Map<string, Date>();
  for (const session of sessions ?? []) {
    const startedAt = new Date((session as { started_at: string }).started_at);
    for (const we of (session as { workout_exercises?: { exercises?: { slug?: string; name?: string } }[] })
      .workout_exercises ?? []) {
      const slug = we.exercises?.slug ?? we.exercises?.name?.toLowerCase().replace(/\s+/g, '-');
      if (!slug) continue;
      const existing = lastUsed.get(slug);
      if (!existing || startedAt > existing) {
        lastUsed.set(slug, startedAt);
      }
    }
  }
  return lastUsed;
}

type SetHistory = {
  weight: number;
  reps: number;
  loggedAt: Date;
  sessions?: Array<{ weight: number; reps: number; hitTarget: boolean }>;
};

export async function getLastPerformanceBySlug(userId: string): Promise<Map<string, SetHistory>> {
  const db = requireAdmin();
  const { data } = await db
    .from('workout_sets')
    .select(
      'weight, reps, logged_at, workout_exercise_id, workout_exercises!inner(exercises(slug), suggested_reps, workout_sessions!inner(id, user_id, status, started_at))',
    )
    .eq('workout_exercises.workout_sessions.user_id', userId)
    .eq('workout_exercises.workout_sessions.status', 'completed')
    .not('weight', 'is', null)
    .not('reps', 'is', null)
    .order('logged_at', { ascending: false })
    .limit(400);

  const bySlugSessions = new Map<string, Map<string, { weight: number; reps: number; targetReps: number }>>();

  for (const row of data ?? []) {
    const we = (row as {
      workout_exercises?: {
        suggested_reps?: string;
        exercises?: { slug?: string };
        workout_sessions?: { id?: string };
      };
    }).workout_exercises;
    const slug = we?.exercises?.slug;
    const sessionId = we?.workout_sessions?.id;
    if (!slug || !sessionId) continue;

    const targetReps = parseInt(String(we?.suggested_reps ?? '8').match(/\d+/)?.[0] ?? '8', 10);
    const sessionMap = bySlugSessions.get(slug) ?? new Map();
    if (!sessionMap.has(sessionId)) {
      sessionMap.set(sessionId, {
        weight: Number(row.weight),
        reps: Number(row.reps),
        targetReps,
      });
    } else {
      const existing = sessionMap.get(sessionId)!;
      existing.reps = Math.max(existing.reps, Number(row.reps));
      existing.weight = Math.max(existing.weight, Number(row.weight));
    }
    bySlugSessions.set(slug, sessionMap);
  }

  const map = new Map<string, SetHistory>();
  for (const [slug, sessionMap] of bySlugSessions) {
    const sessions = [...sessionMap.values()].slice(0, 2).map((s) => ({
      weight: s.weight,
      reps: s.reps,
      hitTarget: s.reps >= s.targetReps,
    }));
    const latest = sessions[0];
    if (!latest) continue;
    map.set(slug, {
      weight: latest.weight,
      reps: latest.reps,
      loggedAt: new Date(),
      sessions,
    });
  }
  return map;
}

function scoreExercise(
  exercise: ExerciseRecord,
  family: string,
  recentSlugs: Map<string, Date>,
  lastWeekSlugs: Set<string>,
): number {
  let score = 10;
  const lastUsed = recentSlugs.get(exercise.slug);
  if (lastUsed) {
    const daysAgo = (Date.now() - lastUsed.getTime()) / (1000 * 60 * 60 * 24);
    score += Math.min(daysAgo, 14);
  } else {
    score += 20;
  }
  if (lastWeekSlugs.has(exercise.slug)) {
    score -= 25;
  }
  if (exercise.metadata?.movement_family === family) {
    score += 5;
  }
  return score;
}

function suggestWeightLbs(
  exercise: ExerciseRecord,
  goal: TrainingGoal,
  history: SetHistory | undefined,
  bodyWeightKg?: number | null,
): number | undefined {
  if (exercise.equipment === 'bodyweight' || exercise.metadata?.requires?.includes('bodyweight')) {
    return undefined;
  }

  if (history) {
    const topRep = goal === 'strength' ? 6 : goal === 'fat_loss' ? 15 : 12;
    if (history.reps >= topRep) {
      return Math.round((history.weight + 5) * 10) / 10;
    }
    return history.weight;
  }

  const bw = bodyWeightKg ?? 75;
  const base = bw * 2.20462;
  const factor =
    exercise.metadata?.movement_family === 'squat_pattern'
      ? 0.65
      : exercise.metadata?.movement_family === 'hinge_pattern'
        ? 0.55
        : exercise.metadata?.movement_family === 'horizontal_press'
          ? 0.45
          : exercise.metadata?.movement_family === 'vertical_press'
            ? 0.25
            : 0.2;
  return Math.round((base * factor) / 5) * 5;
}

export function selectRotatedExercises(
  pool: ExerciseRecord[],
  targetMuscles: string[],
  recentSlugs: Map<string, Date>,
  count: number,
): ExerciseRecord[] {
  const familiesNeeded = new Set<string>();
  for (const muscle of targetMuscles) {
    for (const family of MUSCLE_TO_FAMILIES[muscle] ?? []) {
      familiesNeeded.add(family);
    }
  }
  if (familiesNeeded.size === 0) {
    familiesNeeded.add('squat_pattern');
    familiesNeeded.add('horizontal_pull');
  }

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const lastWeekSlugs = new Set(
    [...recentSlugs.entries()].filter(([, d]) => d >= weekAgo).map(([slug]) => slug),
  );

  const selected: ExerciseRecord[] = [];
  const usedSlugs = new Set<string>();

  for (const family of familiesNeeded) {
    const candidates = pool
      .filter((e) => e.metadata?.movement_family === family && !usedSlugs.has(e.slug))
      .map((e) => ({ exercise: e, score: scoreExercise(e, family, recentSlugs, lastWeekSlugs) }))
      .sort((a, b) => b.score - a.score);

    const pick = candidates[0]?.exercise;
    if (pick) {
      selected.push(pick);
      usedSlugs.add(pick.slug);
    }
    if (selected.length >= count) break;
  }

  // Second and third picks from the same movement families (e.g. incline + flat press).
  let stagnantRounds = 0;
  while (selected.length < count && stagnantRounds < 3) {
    let addedThisRound = 0;
    for (const family of familiesNeeded) {
      if (selected.length >= count) break;
      const candidates = pool
        .filter((e) => e.metadata?.movement_family === family && !usedSlugs.has(e.slug))
        .map((e) => ({ exercise: e, score: scoreExercise(e, family, recentSlugs, lastWeekSlugs) }))
        .sort((a, b) => b.score - a.score);

      const pick = candidates[0]?.exercise;
      if (pick) {
        selected.push(pick);
        usedSlugs.add(pick.slug);
        addedThisRound += 1;
      }
    }
    if (addedThisRound === 0) stagnantRounds += 1;
    else stagnantRounds = 0;
  }

  if (selected.length < count) {
    const targetSet = new Set(targetMuscles.map((m) => m.toLowerCase()));
    const muscleMatched = pool
      .filter((e) => !usedSlugs.has(e.slug))
      .filter((e) => (e.muscle_groups ?? []).some((mg) => targetSet.has(mg.toLowerCase())))
      .map((e) => ({
        exercise: e,
        score: scoreExercise(e, e.metadata?.movement_family ?? '', recentSlugs, lastWeekSlugs),
      }))
      .sort((a, b) => b.score - a.score);

    for (const { exercise } of muscleMatched) {
      if (selected.length >= count) break;
      selected.push(exercise);
      usedSlugs.add(exercise.slug);
    }
  }

  if (selected.length < count) {
    const fillers = pool
      .filter((e) => !usedSlugs.has(e.slug))
      .map((e) => ({ exercise: e, score: scoreExercise(e, e.metadata?.movement_family ?? '', recentSlugs, lastWeekSlugs) }))
      .sort((a, b) => b.score - a.score);
    for (const { exercise } of fillers) {
      if (selected.length >= count) break;
      selected.push(exercise);
      usedSlugs.add(exercise.slug);
    }
  }

  return selected;
}

export type BuildWorkoutPlanOptions = {
  equipmentOverride?: string[];
  includeCore?: boolean;
  targetExerciseCount?: number;
  minimumExercises?: number;
  minimumSets?: number;
};

export function normalizeTargetMuscleGroups(muscles: string[]): string[] {
  const normalized = [...new Set(muscles.map((muscle) => muscle.trim().toLowerCase()).filter(Boolean))];
  if (normalized.length >= 2) return normalized;

  const primary = normalized[0];
  if (primary === 'chest') return ['chest', 'shoulders', 'triceps'];
  if (primary === 'back') return ['back', 'biceps'];
  if (primary === 'legs' || primary === 'quads') return ['legs', 'glutes', 'hamstrings'];
  if (primary === 'shoulders') return ['shoulders', 'triceps'];
  if (primary === 'arms') return ['biceps', 'triceps'];
  if (primary === 'core') return ['core', 'legs'];
  return ['chest', 'back', 'legs', 'shoulders'];
}

export async function buildAdaptiveWorkoutPlan(
  userId: string,
  targetMuscles: string[],
  rationale: string,
  options?: BuildWorkoutPlanOptions,
): Promise<GeneratedWorkoutPlan> {
  const normalizedMuscles = normalizeTargetMuscleGroups(targetMuscles);
  const profile = await loadUserTrainingProfile(userId);
  const basePreset = GOAL_PRESETS[profile.primaryTrainingGoal];
  const preset = blendWorkoutPreset(
    {
      sets: basePreset.sets,
      reps: basePreset.reps,
      restSeconds: basePreset.restSeconds,
      exerciseCount: options?.targetExerciseCount ?? basePreset.exerciseCount,
      includeMobilityFinisher: options?.includeCore ?? false,
      rationaleTags: [],
    },
    profile.fitnessGoals,
  );
  const pool = await loadAvailableExercises(userId, options?.equipmentOverride);
  const recentSlugs = await getRecentExerciseSlugs(userId);
  const performance = await getLastPerformanceBySlug(userId);
  const limitations = await loadActiveLimitations(userId);
  const recoveryMods = await loadRecoveryModifiers(userId);

  const targetCount = Math.max(
    options?.minimumExercises ?? WORKOUT_MIN_EXERCISES,
    options?.targetExerciseCount ?? preset.exerciseCount,
  );
  const minimumSets = Math.max(WORKOUT_MIN_SETS, options?.minimumSets ?? WORKOUT_MIN_SETS);

  const adjustedPreset = {
    ...preset,
    sets: Math.max(minimumSets, Math.round(preset.sets * recoveryMods.volumeMultiplier)),
    exerciseCount: targetCount,
    restSeconds: recoveryMods.recoveryModeActive
      ? Math.round(preset.restSeconds * 1.15)
      : preset.restSeconds,
  };

  if (pool.length === 0) {
    return {
      name: recoveryMods.recoveryModeActive ? 'Recovery Mobility Session' : 'Bodyweight Workout',
      rationale: 'No equipment-matched exercises found — update equipment in onboarding or Settings.',
      muscleGroups: normalizedMuscles,
      exercises: [
        { name: 'Push-Up', sets: adjustedPreset.sets, reps: '12-15', restSeconds: adjustedPreset.restSeconds },
        { name: 'Bodyweight Squat', sets: adjustedPreset.sets, reps: '15-20', restSeconds: adjustedPreset.restSeconds },
        { name: 'Plank', sets: adjustedPreset.sets, reps: '45-60 sec', restSeconds: 45 },
        { name: 'Glute Bridge', sets: adjustedPreset.sets, reps: '12-15', restSeconds: 45 },
      ],
      estimatedMinutes: WORKOUT_TARGET_MINUTES,
      aiGenerated: false,
    };
  }

  let picked = selectRotatedExercises(pool, normalizedMuscles, recentSlugs, adjustedPreset.exerciseCount);

  if (options?.includeCore && !picked.some((exercise) => exercise.muscle_groups?.includes('core'))) {
    const corePick = pool.find(
      (exercise) =>
        exercise.muscle_groups?.includes('core') ||
        exercise.metadata?.movement_family === 'core' ||
        exercise.name.toLowerCase().includes('plank'),
    );
    if (corePick && !picked.some((exercise) => exercise.slug === corePick.slug)) {
      picked = [...picked, corePick];
    }
  }

  if (picked.length < (options?.minimumExercises ?? WORKOUT_MIN_EXERCISES)) {
    const fillers = pool
      .filter((exercise) => !picked.some((item) => item.slug === exercise.slug))
      .slice(0, (options?.minimumExercises ?? WORKOUT_MIN_EXERCISES) - picked.length);
    picked = [...picked, ...fillers];
  }

  let exercises: GeneratedWorkoutExercise[] = picked.map((exercise) => {
    const history = performance.get(exercise.slug);
    let weightLbs = suggestWeightLbs(exercise, profile.primaryTrainingGoal, history, profile.weightKg);
    if (weightLbs && recoveryMods.intensityMultiplier < 1) {
      weightLbs = Math.round(weightLbs * recoveryMods.intensityMultiplier / 5) * 5;
    }

    const notes = history
      ? `Progression from ${history.weight} lb × ${history.reps}`
      : recentSlugs.has(exercise.slug)
        ? 'Rotated variation — focus on form'
        : undefined;

    return {
      name: exercise.name,
      sets: adjustedPreset.sets,
      reps: recoveryMods.recoveryModeActive ? '10-12' : adjustedPreset.reps,
      weightLbs,
      restSeconds: adjustedPreset.restSeconds,
      notes,
    };
  });

  exercises = applySubstitutionsToExercises(exercises, limitations);

  if (preset.includeMobilityFinisher && !exercises.some((e) => e.name === 'Plank')) {
    exercises.push({
      name: 'Plank',
      sets: 2,
      reps: '45-60 sec',
      restSeconds: 45,
      notes: 'Mobility / core finisher',
    });
  }

  const goalLabel =
    preset.rationaleTags.length > 1
      ? preset.rationaleTags.join(' + ')
      : profile.primaryTrainingGoal.replace('_', ' ');

  const recoveryNote = recoveryMods.recoveryModeActive
    ? ' Recovery Mode — volume and intensity reduced.'
    : recoveryMods.volumeMultiplier < 1
      ? ` Volume adjusted to ${Math.round(recoveryMods.volumeMultiplier * 100)}% based on recovery score.`
      : '';

  const limitationNote =
    limitations.length > 0
      ? ` ${limitations.length} active limitation(s) — exercises substituted where needed.`
      : '';

  const rotationNote =
    picked.length > 0
      ? ` Rotated ${picked.map((e) => e.name).join(', ')} based on your equipment and recent sessions.`
      : '';

  return {
    name: recoveryMods.recoveryModeActive
      ? 'Recovery Session'
      : `${normalizedMuscles.slice(0, 3).join(' & ')} — ${goalLabel}`,
    rationale: `${rationale}${rotationNote}${recoveryNote}${limitationNote}`,
    muscleGroups: normalizedMuscles,
    exercises,
    estimatedMinutes: Math.max(
      45,
      Math.min(
        75,
        Math.round(
          exercises.length * adjustedPreset.sets * 2 +
            exercises.length * (adjustedPreset.restSeconds / 60) * 0.35,
        ),
      ),
    ),
    aiGenerated: false,
  };
}

export function filterExerciseLibraryForPrompt(exercises: ExerciseRecord[]): string {
  return exercises
    .map(
      (e) =>
        `${e.name} [${e.slug}] (${(e.muscle_groups ?? []).join(', ')}, requires: ${(e.metadata?.requires ?? [e.equipment]).join('+')})`,
    )
    .join('; ');
}
