import { applyEquipmentSubstitutionsToExercises, findEquipmentSubstitute } from '../equipmentSubstitutionEngine.js';
import { applySubstitutionsToExercises, type LimitationContext } from '../exerciseSubstitution.js';
import { maxPatternUsesForDayFocus, patternExclusionGroupId } from '../movementPatternExclusion.js';
import { applyWeeklyProgression } from '../programProgression.js';
import {
    exerciseMeetsEquipment,
    expandAvailableEquipment,
    getLastPerformanceBySlug,
    isAllowedOnDayFocus,
    loadActiveLimitations,
    loadAvailableExercises,
    loadRecoveryModifiers,
    loadUserTrainingProfile,
    resolveDayFocusPlan,
    suggestWeightLbs,
    type DayFocusPlan,
    type ExerciseRecord,
    type GeneratedWorkoutExercise,
    type GeneratedWorkoutPlan,
} from '../workoutPlanner.js';
import { applyBlockSupersets } from './applyReferenceSupersets.js';
import { MONTH1_EXERCISE_SLUG_MAP } from './month1ExerciseSlugMap.js';
import { MONTH1_WORKOUTS } from './month1Workouts.js';
import {
    isExactMonth1PrescriptionWeek,
    pickRotatedExerciseForBlock,
    resolveBlueprintWeek,
} from './referenceStyleGenerator.js';
import type { Month1ExerciseBlock, Month1Workout } from './types.js';

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function resolveSlugForName(name: string): string {
  if (MONTH1_EXERCISE_SLUG_MAP[name]) return MONTH1_EXERCISE_SLUG_MAP[name];
  const normalized = normalizeName(name);
  for (const [key, slug] of Object.entries(MONTH1_EXERCISE_SLUG_MAP)) {
    if (normalizeName(key) === normalized) return slug;
  }
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function findExerciseInPool(
  name: string,
  slug: string,
  pool: ExerciseRecord[],
): ExerciseRecord | undefined {
  const byExactSlug = pool.find((exercise) => exercise.slug === slug);
  if (byExactSlug) return byExactSlug;

  const target = normalizeName(name);
  const matches = pool.filter((exercise) => normalizeName(exercise.name) === target);
  if (matches.length === 0) return undefined;

  return (
    matches.find((exercise) => !/-(?:qd|ba|la|ch)\d+$/i.test(exercise.slug)) ?? matches[0]
  );
}

function resolveBlockExercise(
  block: Month1ExerciseBlock,
  blockIndex: number,
  pool: ExerciseRecord[],
  available: Set<string>,
  equipmentList: string[],
  options: {
    useExactPrescription: boolean;
    rotationSeed: number;
    recentSlugs: Set<string>;
    usedSlugs: Set<string>;
    dayFocusPlan: DayFocusPlan | null;
    patternGroupUses: Map<string, number>;
  },
): { catalogExercise: ExerciseRecord | null; swapNote?: string } {
  const blueprintSlug = resolveSlugForName(block.name);

  function isAccepted(exercise: ExerciseRecord | null | undefined): exercise is ExerciseRecord {
    if (!exercise || !exerciseMeetsEquipment(exercise, available)) return false;
    if (options.dayFocusPlan && !isAllowedOnDayFocus(exercise, options.dayFocusPlan)) return false;
    const groupId = patternExclusionGroupId(exercise.slug);
    if (groupId && options.dayFocusPlan) {
      const max = maxPatternUsesForDayFocus(options.dayFocusPlan.key, groupId);
      const used = options.patternGroupUses.get(groupId) ?? 0;
      if (used >= max) return false;
    }
    return true;
  }

  function registerPatternUse(exercise: ExerciseRecord): void {
    const groupId = patternExclusionGroupId(exercise.slug);
    if (groupId) {
      options.patternGroupUses.set(groupId, (options.patternGroupUses.get(groupId) ?? 0) + 1);
    }
  }

  function pickFromPool(candidates: ExerciseRecord[]): ExerciseRecord | null {
    for (const candidate of candidates) {
      if (isAccepted(candidate)) return candidate;
    }
    return null;
  }

  let catalogExercise: ExerciseRecord | undefined;

  if (options.useExactPrescription) {
    catalogExercise = findExerciseInPool(block.name, blueprintSlug, pool);
    if (!catalogExercise) {
      const fallbackSlug = blueprintSlug.replace(/-ba\d+$/, '').replace(/-la\d+$/, '');
      catalogExercise = findExerciseInPool(block.name, fallbackSlug, pool);
    }
  } else {
    catalogExercise =
      pickRotatedExerciseForBlock(
        block,
        blockIndex,
        pool,
        options.rotationSeed,
        options.recentSlugs,
        options.usedSlugs,
        blueprintSlug,
      ) ?? findExerciseInPool(block.name, blueprintSlug, pool);
  }

  if (isAccepted(catalogExercise)) {
    registerPatternUse(catalogExercise);
    return { catalogExercise };
  }

  const patternAlternate = pickPatternAlternate(block, pool, options, isAccepted);
  if (patternAlternate) {
    registerPatternUse(patternAlternate);
    return {
      catalogExercise: patternAlternate,
      swapNote: `Substituted for ${block.name} to avoid repeating the same movement pattern`,
    };
  }

  const swap = findEquipmentSubstitute(block.name, equipmentList, pool);
  if (swap) {
    const swapped = findExerciseInPool(swap.to, resolveSlugForName(swap.to), pool);
    if (isAccepted(swapped)) {
      registerPatternUse(swapped);
      return { catalogExercise: swapped, swapNote: swap.reason };
    }
  }

  const rotated = pickRotatedExerciseForBlock(
    block,
    blockIndex,
    pool,
    options.rotationSeed + blockIndex * 41,
    options.recentSlugs,
    options.usedSlugs,
    blueprintSlug,
  );
  if (isAccepted(rotated)) {
    registerPatternUse(rotated);
    return {
      catalogExercise: rotated,
      swapNote: `Substituted for ${block.name} based on your equipment`,
    };
  }

  const focusFallback = pool.filter(
    (exercise) =>
      !options.usedSlugs.has(exercise.slug) &&
      isAccepted(exercise) &&
      (block.primaryFocus
        ? exercise.metadata?.movement_family &&
          parseBlockFocusFamilies(block).some((family) => exercise.metadata?.movement_family === family)
        : true),
  );
  const fallback = pickFromPool(focusFallback);
  if (fallback) {
    registerPatternUse(fallback);
    return {
      catalogExercise: fallback,
      swapNote: `Substituted for ${block.name} to match split focus and equipment`,
    };
  }

  return { catalogExercise: null };
}

function parseBlockFocusFamilies(block: Month1ExerciseBlock): string[] {
  const focus = block.primaryFocus.toLowerCase();
  if (focus.includes('triceps') || focus.includes('tricep')) return ['triceps'];
  if (focus.includes('shoulder') || focus.includes('delt')) return ['vertical_press', 'rear_delt'];
  if (focus.includes('chest')) return ['horizontal_press'];
  if (focus.includes('back') || focus.includes('lat')) return ['horizontal_pull', 'vertical_pull'];
  if (focus.includes('biceps') || focus.includes('bicep')) return ['biceps'];
  if (focus.includes('core')) return ['core', 'core_rotation', 'core_anti_extension', 'core_flexion'];
  return [];
}

function pickPatternAlternate(
  block: Month1ExerciseBlock,
  pool: ExerciseRecord[],
  options: { usedSlugs: Set<string> },
  isAccepted: (exercise: ExerciseRecord | null | undefined) => exercise is ExerciseRecord,
): ExerciseRecord | null {
  const focus = block.primaryFocus.toLowerCase();
  const alternateFamilies: string[] = [];

  if (focus.includes('shoulder') || focus.includes('delt')) {
    alternateFamilies.push('rear_delt', 'triceps', 'horizontal_press');
  } else if (focus.includes('triceps') || focus.includes('tricep')) {
    alternateFamilies.push('triceps', 'horizontal_press');
  } else if (focus.includes('chest')) {
    alternateFamilies.push('horizontal_press', 'triceps', 'rear_delt');
  }

  for (const family of alternateFamilies) {
    const match = pool.find(
      (exercise) =>
        !options.usedSlugs.has(exercise.slug) &&
        exercise.metadata?.movement_family === family &&
        isAccepted(exercise),
    );
    if (match) return match;
  }

  return null;
}

function formatExerciseNotes(block: Month1ExerciseBlock, workoutNotes?: string, phaseLabel?: string): string {
  const parts = [`Block ${block.block}`];
  if (block.tempo && block.tempo !== 'controlled') {
    parts.push(`Tempo ${block.tempo}`);
  }
  if (block.primaryFocus) {
    parts.push(block.primaryFocus);
  }
  if (block.block.endsWith('1') || block.block.endsWith('2')) {
    parts.push('Superset — rest after both movements');
  }
  if (phaseLabel) {
    parts.push(phaseLabel);
  } else if (workoutNotes && block.block === 'A') {
    parts.push(workoutNotes.split('.')[0]);
  }
  return parts.join(' · ');
}

export function getMonth1Workout(week: number, dayIndex: number): Month1Workout | null {
  return (
    MONTH1_WORKOUTS.find((workout) => workout.week === week && workout.dayIndex === dayIndex) ?? null
  );
}

export function resolveMonth1Workout(
  week: number,
  dayIndex: number,
  slotLabel: string,
): Month1Workout | null {
  const direct = getMonth1Workout(week, dayIndex);
  if (direct) return direct;

  const bySlot = MONTH1_WORKOUTS.filter(
    (workout) => workout.week === week && workout.slotLabel === slotLabel,
  );
  if (bySlot.length === 1) return bySlot[0];

  const byLabelAnyWeek = MONTH1_WORKOUTS.filter((workout) => workout.slotLabel === slotLabel);
  if (byLabelAnyWeek.length > 0) {
    return byLabelAnyWeek[(week - 1) % byLabelAnyWeek.length] ?? byLabelAnyWeek[0];
  }
  return null;
}

type BuildReferenceOptions = {
  equipmentOverride?: string[];
  weekNumber: number;
  dayIndex: number;
  slotLabel: string;
  rationalePrefix?: string;
  rotationSeed?: number;
  splitOccurrenceIndex?: number;
};

export async function buildReferenceStyleWorkoutPlan(
  userId: string,
  targetMuscles: string[],
  options: BuildReferenceOptions,
): Promise<GeneratedWorkoutPlan | null> {
  const splitOccurrenceIndex = options.splitOccurrenceIndex ?? 0;
  const blueprintWeek = resolveBlueprintWeek(options.weekNumber, splitOccurrenceIndex);
  const reference = resolveMonth1Workout(blueprintWeek, options.dayIndex, options.slotLabel);
  if (!reference) return null;

  const useExactPrescription = isExactMonth1PrescriptionWeek(options.weekNumber);
  const rotationSeed = options.rotationSeed ?? options.weekNumber * 17 + options.dayIndex;

  const profile = await loadUserTrainingProfile(userId);
  const fullPool = await loadAvailableExercises(userId, options.equipmentOverride);
  const dayFocusPlan = resolveDayFocusPlan(options.slotLabel);
  const pool = dayFocusPlan
    ? fullPool.filter((exercise) => isAllowedOnDayFocus(exercise, dayFocusPlan))
    : fullPool;
  const equipmentList = options.equipmentOverride?.length
    ? options.equipmentOverride
    : profile.availableEquipment;
  const available = expandAvailableEquipment(equipmentList);
  const performance = await getLastPerformanceBySlug(userId);
  const limitations = await loadActiveLimitations(userId);
  const recoveryMods = await loadRecoveryModifiers(userId);

  const recentSlugs = new Set<string>();
  for (const [slug, history] of performance) {
    if (history.sessions?.length) recentSlugs.add(slug);
  }
  const usedSlugs = new Set<string>();
  const patternGroupUses = new Map<string, number>();

  const draft: Array<
    GeneratedWorkoutExercise & { block?: string; slug?: string; metadata?: ExerciseRecord['metadata'] }
  > = [];

  for (let blockIndex = 0; blockIndex < reference.exercises.length; blockIndex++) {
    const block = reference.exercises[blockIndex];
    const { catalogExercise, swapNote } = resolveBlockExercise(
      block,
      blockIndex,
      pool,
      available,
      equipmentList,
      {
        useExactPrescription,
        rotationSeed,
        recentSlugs,
        usedSlugs,
        dayFocusPlan,
        patternGroupUses,
      },
    );

    if (!catalogExercise) {
      continue;
    }

    const resolvedName = catalogExercise.name;
    const resolvedSlug = catalogExercise.slug;
    usedSlugs.add(catalogExercise.slug);

    let sets = block.sets;
    if (recoveryMods.volumeMultiplier < 1) {
      sets = Math.max(2, Math.round(sets * recoveryMods.volumeMultiplier));
    }

    const history = performance.get(resolvedSlug);
    let weightLbs = suggestWeightLbs(
      catalogExercise,
      profile.primaryTrainingGoal,
      history,
      profile.weightKg,
    );

    if (weightLbs && recoveryMods.intensityMultiplier < 1) {
      weightLbs = Math.round((weightLbs * recoveryMods.intensityMultiplier) / 5) * 5;
    }

    const phaseLabel = useExactPrescription
      ? undefined
      : `Month 1 style · Week ${options.weekNumber}`;

    const notes = [formatExerciseNotes(block, reference.workoutNotes, phaseLabel), swapNote]
      .filter(Boolean)
      .join(' · ');

    draft.push({
      name: resolvedName,
      slug: resolvedSlug,
      block: block.block,
      sets,
      reps: recoveryMods.recoveryModeActive ? adjustRepsForRecovery(block.reps) : block.reps,
      restSeconds: block.restSeconds,
      weightLbs,
      metadata: catalogExercise.metadata,
      notes,
    });
  }

  let exercises = applySubstitutionsToExercises(
    draft.map(({ slug: _slug, block: _block, metadata: _meta, ...exercise }) => exercise),
    limitations as LimitationContext[],
  );

  if (equipmentList.length) {
    const swapped = applyEquipmentSubstitutionsToExercises(exercises, equipmentList, pool);
    exercises = swapped.exercises.map((exercise) => {
      const catalog = findExerciseInPool(exercise.name, resolveSlugForName(exercise.name), pool);
      if (catalog && (!dayFocusPlan || isAllowedOnDayFocus(catalog, dayFocusPlan))) {
        return exercise;
      }
      const reswap = findEquipmentSubstitute(exercise.name, equipmentList, pool);
      if (!reswap) return exercise;
      const replacement = findExerciseInPool(reswap.to, resolveSlugForName(reswap.to), pool);
      if (!replacement || (dayFocusPlan && !isAllowedOnDayFocus(replacement, dayFocusPlan))) {
        return exercise;
      }
      return {
        ...exercise,
        name: reswap.to,
        notes: [exercise.notes, reswap.reason].filter(Boolean).join(' · '),
      };
    });
  }

  exercises = applyWeeklyProgression(
    exercises,
    performance,
    useExactPrescription ? 1 : 1.02,
    recoveryMods.volumeMultiplier,
  );

  const withBlocks = draft.map((item, index) => ({
    ...exercises[index],
    block: item.block,
    metadata: item.metadata,
  }));

  const supersetted = applyBlockSupersets(withBlocks).map(
    ({ block: _block, metadata: _meta, ...exercise }) => exercise,
  );

  const recoveryNote = recoveryMods.recoveryModeActive
    ? ' Recovery Mode — volume adjusted while preserving reference structure.'
    : '';

  const estimatedMinutes = Math.max(
    50,
    Math.min(
      75,
      Math.round(
        supersetted.reduce((sum, exercise) => sum + exercise.sets * 2 + exercise.restSeconds / 60, 0),
      ),
    ),
  );

  const programLabel = useExactPrescription
    ? 'Month 1 reference program'
    : 'Month 1 coaching standard';

  return {
    name: `${reference.slotLabel} — Week ${options.weekNumber}`,
    rationale: `${options.rationalePrefix ?? programLabel} · Compound-first split with B1/B2 supersets and ~12 working sets per target muscle.${recoveryNote}`,
    muscleGroups: targetMuscles,
    exercises: supersetted,
    estimatedMinutes,
    aiGenerated: false,
  };
}

/** @deprecated Use buildReferenceStyleWorkoutPlan */
export const buildMonth1ReferenceWorkoutPlan = buildReferenceStyleWorkoutPlan;

function adjustRepsForRecovery(reps: string): string {
  if (/sec|hold|AMRAP|yd|circles/i.test(reps)) return reps;
  return '10-12';
}

/** All body-part split programs follow the Month 1 coaching standard (exact Rx weeks 1–4). */
export function shouldUseReferenceLiftingProgram(
  programType: string,
  frequency: number | 'custom',
): boolean {
  if (programType !== 'body_part_split') return false;
  if (frequency === 'custom') return false;
  return frequency >= 3 && frequency <= 7;
}

/** @deprecated Use shouldUseReferenceLiftingProgram */
export function shouldUseMonth1Reference(
  programType: string,
  frequency: number | 'custom',
  _weekNumber: number,
): boolean {
  return shouldUseReferenceLiftingProgram(programType, frequency);
}
