import { expandEquipmentRequirements } from './equipmentCatalog.js';
import { isCatalogVariantSlug } from './exerciseCatalogDedup.js';
import {
    applySubstitutionsToExercises,
    type LimitationContext,
} from './exerciseSubstitution.js';
import { maxPatternUsesForDayFocus, patternExclusionGroupId } from './movementPatternExclusion.js';
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
  core: ['core', 'core_flexion', 'core_rotation', 'core_anti_extension'],
  quads: ['squat_pattern', 'lunge_pattern'],
  glutes: ['hinge_pattern', 'lunge_pattern', 'glute_pattern'],
  hamstrings: ['hinge_pattern', 'hamstrings'],
  calves: ['calves'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  lower_back: ['hinge_pattern', 'horizontal_pull'],
  unilateral: ['lunge_pattern'],
};

export type DayFocusPlan = {
  key: string;
  quotas: Array<{ muscles: string[]; min: number }>;
  excludePrimaryMuscles: string[];
};

export const BODY_PART_DAY_PLANS: Record<string, DayFocusPlan> = {
  back_biceps_core: {
    key: 'back_biceps_core',
    quotas: [
      { muscles: ['back'], min: 4 },
      { muscles: ['biceps'], min: 3 },
      { muscles: ['core'], min: 3 },
    ],
    excludePrimaryMuscles: ['chest', 'triceps', 'shoulders', 'quads', 'hamstrings', 'glutes', 'calves'],
  },
  chest_shoulders_triceps: {
    key: 'chest_shoulders_triceps',
    quotas: [
      { muscles: ['chest'], min: 3 },
      { muscles: ['shoulders'], min: 3 },
      { muscles: ['triceps'], min: 3 },
    ],
    excludePrimaryMuscles: ['back', 'biceps', 'quads', 'hamstrings', 'glutes', 'calves'],
  },
  legs_core: {
    key: 'legs_core',
    quotas: [
      { muscles: ['quads'], min: 3 },
      { muscles: ['hamstrings'], min: 3 },
      { muscles: ['glutes'], min: 3 },
      { muscles: ['calves'], min: 2 },
      { muscles: ['core'], min: 3 },
    ],
    excludePrimaryMuscles: ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
  },
};

export function resolveDayFocusPlan(slotLabel: string): DayFocusPlan | null {
  const key = slotLabel.toLowerCase();
  if (key.includes('back') && key.includes('biceps')) return BODY_PART_DAY_PLANS.back_biceps_core;
  if (key.includes('chest') && key.includes('shoulder')) return BODY_PART_DAY_PLANS.chest_shoulders_triceps;
  if (key.includes('leg')) return BODY_PART_DAY_PLANS.legs_core;
  return null;
}

function exerciseHitsMuscle(exercise: ExerciseRecord, muscle: string): boolean {
  const groups = (exercise.muscle_groups ?? []).map((group) => group.toLowerCase());
  if (groups.includes(muscle)) return true;
  if (muscle === 'legs') {
    return groups.some((group) => ['quads', 'hamstrings', 'glutes', 'calves', 'legs'].includes(group));
  }
  return false;
}

function isExcludedForDayFocus(exercise: ExerciseRecord, excludePrimaryMuscles: string[]): boolean {
  if (excludePrimaryMuscles.length === 0) return false;
  const primary = primaryMuscleGroup(exercise);
  if (!primary) return false;
  return excludePrimaryMuscles.includes(primary);
}

const LEG_PRIMARY_MUSCLES = new Set(['quads', 'hamstrings', 'glutes', 'calves', 'legs', 'unilateral']);
const UPPER_PRIMARY_MUSCLES = new Set(['chest', 'back', 'shoulders', 'biceps', 'triceps']);
const CORE_MOVEMENT_FAMILIES = new Set(['core', 'core_flexion', 'core_rotation', 'core_anti_extension']);
const CORE_FOCUSED_SLUGS = new Set([
  'plank',
  'side-plank',
  'hanging-leg-raise',
  'crunch',
  'cable-crunch',
  'reverse-crunch',
  'bicycle-crunch',
  'sit-up',
  'dead-bug',
  'hollow-hold',
  'russian-twist',
  'wood-chop',
]);

function primaryMuscleGroup(exercise: ExerciseRecord): string {
  return (exercise.muscle_groups ?? [])[0]?.toLowerCase() ?? '';
}

/** True when core is the primary training target — not a secondary tag on a leg lift. */
export function isCoreFocusedExercise(exercise: ExerciseRecord): boolean {
  const primary = primaryMuscleGroup(exercise);
  if (primary === 'core' || primary === 'obliques') return true;
  if (exercise.category === 'core') return true;
  const family = exercise.metadata?.movement_family ?? '';
  if (CORE_MOVEMENT_FAMILIES.has(family)) return true;
  if (CORE_FOCUSED_SLUGS.has(exercise.slug)) return true;
  return false;
}

export function exerciseMatchesQuotaMuscle(exercise: ExerciseRecord, muscle: string): boolean {
  if (muscle === 'core') {
    return isCoreFocusedExercise(exercise);
  }

  const primary = primaryMuscleGroup(exercise);
  const family = exercise.metadata?.movement_family ?? '';

  if (muscle === 'back') {
    return (
      primary === 'back' ||
      ['horizontal_pull', 'vertical_pull'].includes(family) ||
      (family === 'rear_delt' && (exercise.muscle_groups ?? []).map((g) => g.toLowerCase()).includes('back'))
    );
  }

  if (muscle === 'biceps') {
    return primary === 'biceps' || family === 'biceps';
  }

  if (muscle === 'chest') {
    return primary === 'chest' || family === 'horizontal_press';
  }

  if (muscle === 'shoulders') {
    return primary === 'shoulders' || ['vertical_press', 'rear_delt'].includes(family);
  }

  if (muscle === 'triceps') {
    return primary === 'triceps' || family === 'triceps';
  }

  if (['quads', 'glutes', 'hamstrings', 'calves'].includes(muscle)) {
    return primary === muscle || (muscle === 'quads' && primary === 'legs');
  }

  return primary === muscle;
}

const UPPER_DAY_PULL_FAMILIES = new Set(['horizontal_pull', 'vertical_pull']);
const LOWER_DAY_PUSH_FAMILIES = new Set(['horizontal_press', 'vertical_press', 'triceps']);

function exerciseNameLooksLikeGluteIsolation(name: string): boolean {
  const key = name.toLowerCase();
  if (/\btriceps kickback\b|\bcable triceps kickback\b/.test(key)) return false;
  return (
    /\bglute kickback\b|\bcable glute kickback\b|\bdonkey kick\b|\bfire hydrant\b|\bhip abduction\b/.test(
      key,
    ) || (/\bkickback\b/.test(key) && /\bglute\b/.test(key))
  );
}

function exerciseNameLooksLikeBandExercise(name: string, slug: string): boolean {
  const key = `${name} ${slug}`.toLowerCase();
  return /\bband row\b|\bband pull\b|\bband curl\b|\bseated band row\b/.test(key) || slug.startsWith('band-');
}

/** Hard guards against catalog metadata mistakes (e.g. glute kickback tagged as triceps). */
export function isIncompatibleWithDayFocus(exercise: ExerciseRecord, plan: DayFocusPlan): boolean {
  const primary = primaryMuscleGroup(exercise);
  const family = exercise.metadata?.movement_family ?? '';
  const slug = exercise.slug.toLowerCase();
  const name = exercise.name.toLowerCase();

  if (plan.key === 'chest_shoulders_triceps') {
    if (exerciseNameLooksLikeGluteIsolation(exercise.name)) return true;
    if (exerciseNameLooksLikeBandExercise(exercise.name, exercise.slug)) return true;
    if (UPPER_DAY_PULL_FAMILIES.has(family)) return true;
    if (slug.includes('row') || slug.includes('pulldown') || slug.includes('pull-up') || slug.includes('pullup')) {
      return true;
    }
    if (['glutes', 'quads', 'hamstrings', 'calves', 'legs'].includes(primary)) return true;
  }

  if (plan.key === 'back_biceps_core') {
    if (exerciseNameLooksLikeGluteIsolation(exercise.name)) return true;
    if (LOWER_DAY_PUSH_FAMILIES.has(family) && !['rear_delt'].includes(family)) return true;
    if (['chest', 'quads', 'hamstrings', 'glutes', 'calves'].includes(primary)) return true;
  }

  if (plan.key === 'legs_core') {
    if (['chest', 'back', 'shoulders', 'biceps', 'triceps'].includes(primary)) return true;
    if (family === 'biceps' || family === 'triceps') return true;
  }

  if (exerciseNameLooksLikeGluteIsolation(name) && plan.key !== 'legs_core') return true;

  return false;
}

export function isAllowedOnDayFocus(exercise: ExerciseRecord, plan: DayFocusPlan): boolean {
  if (isIncompatibleWithDayFocus(exercise, plan)) return false;
  if (isExcludedForDayFocus(exercise, plan.excludePrimaryMuscles)) return false;

  const primary = primaryMuscleGroup(exercise);
  const allowedMuscles = plan.quotas.flatMap((quota) => quota.muscles);

  if (plan.key === 'back_biceps_core' || plan.key === 'chest_shoulders_triceps') {
    if (LEG_PRIMARY_MUSCLES.has(primary)) return false;
  }
  if (plan.key === 'legs_core') {
    if (UPPER_PRIMARY_MUSCLES.has(primary)) return false;
  }

  return allowedMuscles.some((muscle) => exerciseMatchesQuotaMuscle(exercise, muscle));
}

const GOAL_PRESETS: Record<
  TrainingGoal,
  { sets: number; reps: string; restSeconds: number; exerciseCount: number }
> = {
  fat_loss: { sets: 3, reps: '12-15', restSeconds: 45, exerciseCount: 10 },
  muscle_gain: { sets: 3, reps: '8-12', restSeconds: 90, exerciseCount: 10 },
  strength: { sets: 3, reps: '4-6', restSeconds: 150, exerciseCount: 10 },
  general_fitness: { sets: 3, reps: '10-12', restSeconds: 60, exerciseCount: 10 },
};

export const WORKOUT_MIN_EXERCISES = 8;
export const WORKOUT_MIN_SETS = 3;
export const WORKOUT_TARGET_EXERCISES = 10;
export const WORKOUT_TARGET_MINUTES = 60;

export function expandAvailableEquipment(raw: string[]): Set<string> {
  return expandEquipmentRequirements(raw);
}

/** Requirement keys implied by the exercises.equipment column (authoritative for catalog rows). */
const EQUIPMENT_FIELD_REQUIREMENTS: Record<string, string[]> = {
  dumbbell: ['dumbbells'],
  kettlebell: ['kettlebells'],
  cable: ['machines'],
  machine: ['machines'],
  barbell: ['barbell'],
  bands: ['bands'],
  bodyweight: ['bodyweight'],
  rower: ['machines'],
};

export function resolveExerciseRequirements(exercise: ExerciseRecord): string[] {
  const field = EQUIPMENT_FIELD_REQUIREMENTS[exercise.equipment];
  const meta = exercise.metadata?.requires ?? [];

  if (exercise.equipment === 'barbell') {
    const needs = new Set<string>(['barbell']);
    if (meta.includes('rack')) needs.add('rack');
    return [...needs];
  }
  if (field) return field;
  if (meta.length > 0) return meta;
  return [legacyEquipmentToRequirement(exercise.equipment)];
}

export function exerciseMeetsEquipment(exercise: ExerciseRecord, available: Set<string>): boolean {
  return resolveExerciseRequirements(exercise).every((req) => available.has(req));
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
  profileOverride?: UserTrainingProfile,
): Promise<ExerciseRecord[]> {
  const profile = profileOverride ?? await loadUserTrainingProfile(userId);
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
    .filter((exercise) => exerciseMeetsEquipment(exercise, available))
    .filter((exercise) => !isCatalogVariantSlug(exercise.slug));

  if (filtered.length < WORKOUT_TARGET_EXERCISES) {
    const expanded = expandAvailableEquipment([...equipment, 'bodyweight']);
    const supplemental = (data ?? [])
      .map((row) => ({
        ...row,
        metadata: (row.metadata ?? {}) as ExerciseRecord['metadata'],
      }))
      .filter((exercise) => exerciseMeetsEquipment(exercise, expanded))
      .filter((exercise) => !isCatalogVariantSlug(exercise.slug));

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
  rotationSeed = 0,
  programRecentSlugs?: Set<string>,
  available?: Set<string>,
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
  if (programRecentSlugs?.has(exercise.slug)) {
    score -= 40;
  }
  if (exercise.metadata?.movement_family === family) {
    score += 5;
  }
  if (available) {
    const fieldReq = EQUIPMENT_FIELD_REQUIREMENTS[exercise.equipment]?.[0];
    if (fieldReq && available.has(fieldReq)) {
      score += 15;
    }
    if (exercise.equipment === 'dumbbell' && available.has('dumbbells')) {
      score += 8;
    }
    if (exercise.equipment === 'bodyweight' && available.has('bodyweight')) {
      score += 6;
    }
  }
  const slugHash = exercise.slug.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  score += ((slugHash + rotationSeed * 31) % 17) * 1.5;
  return score;
}

export function suggestWeightLbs(
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

export function selectFocusedSplitExercises(
  pool: ExerciseRecord[],
  plan: DayFocusPlan,
  recentSlugs: Map<string, Date>,
  count: number,
  rotationSeed = 0,
  programRecentSlugs?: Set<string>,
  available?: Set<string>,
): ExerciseRecord[] {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const lastWeekSlugs = new Set(
    [...recentSlugs.entries()].filter(([, date]) => date >= weekAgo).map(([slug]) => slug),
  );

  const eligible = pool.filter((exercise) => isAllowedOnDayFocus(exercise, plan));
  const selected: ExerciseRecord[] = [];
  const usedSlugs = new Set<string>();
  const usedNormalizedNames = new Set<string>();
  const patternUseCounts = new Map<string, number>();

  function registerPick(exercise: ExerciseRecord): void {
    selected.push(exercise);
    usedSlugs.add(exercise.slug);
    usedNormalizedNames.add(exercise.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim());
    const patternGroup = patternExclusionGroupId(exercise.slug);
    if (patternGroup) {
      patternUseCounts.set(patternGroup, (patternUseCounts.get(patternGroup) ?? 0) + 1);
    }
  }

  function rankCandidates(candidates: ExerciseRecord[], seedOffset: number) {
    return candidates
      .map((exercise) => ({
        exercise,
        score: scoreExercise(
          exercise,
          exercise.metadata?.movement_family ?? '',
          recentSlugs,
          lastWeekSlugs,
          rotationSeed + seedOffset,
          programRecentSlugs,
          available,
        ),
      }))
      .sort((a, b) => b.score - a.score);
  }

  function canPick(exercise: ExerciseRecord, allowProgramReuse = false, relaxPatterns = false): boolean {
    if (usedSlugs.has(exercise.slug)) return false;
    const normalizedName = exercise.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (usedNormalizedNames.has(normalizedName)) return false;
    if (!allowProgramReuse && programRecentSlugs?.has(exercise.slug)) return false;
    const patternGroup = patternExclusionGroupId(exercise.slug);
    if (patternGroup) {
      const maxUses = relaxPatterns
        ? maxPatternUsesForDayFocus(plan.key, patternGroup) + 1
        : maxPatternUsesForDayFocus(plan.key, patternGroup);
      const used = patternUseCounts.get(patternGroup) ?? 0;
      if (used >= maxUses) return false;
    }
    return true;
  }

  function pickForQuota(quota: DayFocusPlan['quotas'][number], allowProgramReuse: boolean): number {
    let pickedForQuota = 0;
    while (pickedForQuota < quota.min && selected.length < count) {
      const candidates = rankCandidates(
        eligible.filter(
          (exercise) =>
            canPick(exercise, allowProgramReuse) &&
            quota.muscles.some((muscle) => exerciseMatchesQuotaMuscle(exercise, muscle)),
        ),
        pickedForQuota * 17 + selected.length,
      );
      const pick = candidates[0]?.exercise;
      if (!pick) break;
      registerPick(pick);
      pickedForQuota += 1;
    }
    return pickedForQuota;
  }

  for (const quota of plan.quotas) {
    const strictCount = pickForQuota(quota, false);
    if (strictCount < quota.min) {
      pickForQuota(quota, true);
    }
  }

  const allowedMuscles = new Set(plan.quotas.flatMap((quota) => quota.muscles));
  while (selected.length < count) {
    const candidates = rankCandidates(
      eligible.filter(
        (exercise) =>
          canPick(exercise, false) &&
          [...allowedMuscles].some((muscle) => exerciseMatchesQuotaMuscle(exercise, muscle)),
      ),
      selected.length * 23,
    );
    let pick = candidates[0]?.exercise;
    if (!pick) {
      const relaxed = rankCandidates(
        eligible.filter(
          (exercise) =>
            canPick(exercise, true) &&
            [...allowedMuscles].some((muscle) => exerciseMatchesQuotaMuscle(exercise, muscle)),
        ),
        selected.length * 29,
      );
      pick = relaxed[0]?.exercise;
    }
    if (!pick) break;
    registerPick(pick);
  }

  if (selected.length < count) {
    while (selected.length < count) {
      const candidates = rankCandidates(
        eligible.filter(
          (exercise) =>
            canPick(exercise, true, true) &&
            [...allowedMuscles].some((muscle) => exerciseMatchesQuotaMuscle(exercise, muscle)),
        ),
        selected.length * 31,
      );
      const pick = candidates[0]?.exercise;
      if (!pick) break;
      registerPick(pick);
    }
  }

  return selected.slice(0, count);
}

export function selectRotatedExercises(
  pool: ExerciseRecord[],
  targetMuscles: string[],
  recentSlugs: Map<string, Date>,
  count: number,
  rotationSeed = 0,
  programRecentSlugs?: Set<string>,
  available?: Set<string>,
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
  const usedPatternGroups = new Set<string>();

  function canPick(exercise: ExerciseRecord): boolean {
    if (usedSlugs.has(exercise.slug)) return false;
    const patternGroup = patternExclusionGroupId(exercise.slug);
    if (patternGroup && usedPatternGroups.has(patternGroup)) return false;
    return true;
  }

  function registerPick(exercise: ExerciseRecord): void {
    selected.push(exercise);
    usedSlugs.add(exercise.slug);
    const patternGroup = patternExclusionGroupId(exercise.slug);
    if (patternGroup) usedPatternGroups.add(patternGroup);
  }

  for (const family of familiesNeeded) {
    const candidates = pool
      .filter((e) => e.metadata?.movement_family === family && canPick(e))
      .map((e) => ({ exercise: e, score: scoreExercise(e, family, recentSlugs, lastWeekSlugs, rotationSeed, programRecentSlugs, available) }))
      .sort((a, b) => b.score - a.score);

    const pick = candidates[0]?.exercise;
    if (pick) {
      registerPick(pick);
    }
    if (selected.length >= count) break;
  }

  // Fill remaining slots without repeating movement pattern families.
  let stagnantRounds = 0;
  while (selected.length < count && stagnantRounds < 3) {
    let addedThisRound = 0;
    for (const family of familiesNeeded) {
      if (selected.length >= count) break;
      const candidates = pool
        .filter((e) => e.metadata?.movement_family === family && canPick(e))
        .map((e) => ({ exercise: e, score: scoreExercise(e, family, recentSlugs, lastWeekSlugs, rotationSeed, programRecentSlugs, available) }))
        .sort((a, b) => b.score - a.score);

      const pick = candidates[0]?.exercise;
      if (pick) {
        registerPick(pick);
        addedThisRound += 1;
      }
    }
    if (addedThisRound === 0) stagnantRounds += 1;
    else stagnantRounds = 0;
  }

  if (selected.length < count) {
    const targetSet = new Set(targetMuscles.map((m) => m.toLowerCase()));
    const muscleMatched = pool
      .filter((e) => canPick(e))
      .filter((e) => (e.muscle_groups ?? []).some((mg) => targetSet.has(mg.toLowerCase())))
      .map((e) => ({
        exercise: e,
        score: scoreExercise(e, e.metadata?.movement_family ?? '', recentSlugs, lastWeekSlugs, rotationSeed, programRecentSlugs, available),
      }))
      .sort((a, b) => b.score - a.score);

    for (const { exercise } of muscleMatched) {
      if (selected.length >= count) break;
      registerPick(exercise);
    }
  }

  if (selected.length < count) {
    const fillers = pool
      .filter((e) => canPick(e))
      .map((e) => ({ exercise: e, score: scoreExercise(e, e.metadata?.movement_family ?? '', recentSlugs, lastWeekSlugs, rotationSeed, programRecentSlugs) }))
      .sort((a, b) => b.score - a.score);
    for (const { exercise } of fillers) {
      if (selected.length >= count) break;
      registerPick(exercise);
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
  /** Slugs already assigned earlier in this program generation — avoids duplicate days. */
  programRecentSlugs?: Map<string, Date>;
  /** Per-calendar-day seed so repeated split labels pick different exercises. */
  rotationSeed?: number;
  /** Which time this split label appears in the week (0 = first Back day, 1 = second, …). */
  splitOccurrenceIndex?: number;
  /** Day label from the program schedule (e.g. "Back, Biceps & Core"). */
  slotLabel?: string;
};

export function normalizeTargetMuscleGroups(muscles: string[]): string[] {
  const normalized = [...new Set(muscles.map((muscle) => muscle.trim().toLowerCase()).filter(Boolean))];
  if (normalized.length >= 2) return normalized;

  const primary = normalized[0];
  if (primary === 'chest') return ['chest', 'shoulders', 'triceps'];
  if (primary === 'back') return ['back', 'biceps'];
  if (primary === 'legs' || primary === 'quads' || primary === 'lower') {
    return ['quads', 'hamstrings', 'glutes', 'calves', 'core', 'unilateral'];
  }
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
  const profilePromise = loadUserTrainingProfile(userId);
  const recentSlugsPromise = getRecentExerciseSlugs(userId);
  const performancePromise = getLastPerformanceBySlug(userId);
  const limitationsPromise = loadActiveLimitations(userId);
  const recoveryModsPromise = loadRecoveryModifiers(userId);

  const profile = await profilePromise;
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

  const poolPromise = loadAvailableExercises(userId, options?.equipmentOverride, profile);
  const [pool, recentSlugs, performance, limitations, recoveryMods] = await Promise.all([
    poolPromise,
    recentSlugsPromise,
    performancePromise,
    limitationsPromise,
    recoveryModsPromise,
  ]);

  const equipmentList = options?.equipmentOverride?.length
    ? options.equipmentOverride
    : profile.availableEquipment;
  const available = expandAvailableEquipment(equipmentList);
  if (options?.programRecentSlugs) {
    for (const [slug, usedAt] of options.programRecentSlugs) {
      const existing = recentSlugs.get(slug);
      if (!existing || usedAt > existing) {
        recentSlugs.set(slug, usedAt);
      }
    }
  }
  const rotationSeed = options?.rotationSeed ?? 0;
  const splitOccurrenceIndex = options?.splitOccurrenceIndex ?? 0;
  const effectiveRotationSeed = rotationSeed + splitOccurrenceIndex * 997;
  const programRecentSet = options?.programRecentSlugs
    ? new Set(options.programRecentSlugs.keys())
    : undefined;
  const focusPlan = options?.slotLabel ? resolveDayFocusPlan(options.slotLabel) : null;

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

  let picked = focusPlan
    ? selectFocusedSplitExercises(
        pool,
        focusPlan,
        recentSlugs,
        adjustedPreset.exerciseCount,
        effectiveRotationSeed,
        programRecentSet,
        available,
      )
    : selectRotatedExercises(
        pool,
        normalizedMuscles,
        recentSlugs,
        adjustedPreset.exerciseCount,
        effectiveRotationSeed,
        programRecentSet,
        available,
      );

  if (options?.programRecentSlugs) {
    const now = new Date();
    for (const exercise of picked) {
      options.programRecentSlugs.set(exercise.slug, now);
    }
  }

  if (options?.includeCore && !picked.some((exercise) => isCoreFocusedExercise(exercise))) {
    const corePick = pool.find(
      (exercise) =>
        isCoreFocusedExercise(exercise) &&
        (!focusPlan || isAllowedOnDayFocus(exercise, focusPlan)),
    );
    if (corePick && !picked.some((exercise) => exercise.slug === corePick.slug)) {
      picked = [...picked, corePick];
    }
  }

  if (picked.length < targetCount) {
    const allowedMuscles = focusPlan
      ? focusPlan.quotas.flatMap((quota) => quota.muscles)
      : normalizedMuscles;
    const fillers = pool
      .filter((exercise) => {
        if (picked.some((item) => item.slug === exercise.slug)) return false;
        if (focusPlan) return isAllowedOnDayFocus(exercise, focusPlan);
        return allowedMuscles.some((muscle) => exerciseHitsMuscle(exercise, muscle));
      })
      .slice(0, targetCount - picked.length);
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
