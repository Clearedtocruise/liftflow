import {
    exerciseMatchesQuotaMuscle,
    isCoreFocusedExercise,
    type ExerciseRecord,
} from '../workoutPlanner.js';
import type { Month1ExerciseBlock } from './types.js';

const HEAVY_COMPOUND_FAMILIES = new Set([
  'horizontal_press',
  'vertical_press',
  'vertical_pull',
  'horizontal_pull',
  'squat_pattern',
  'hinge_pattern',
]);

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Parse "Quads/Glutes", "Back/Biceps", or block name into muscle keys. */
export function parsePrimaryFocusMuscles(focus: string, blockName?: string): string[] {
  const cleaned = normalizeToken(focus)
    .replace(/after\s+[a-z]\d?\s+/gi, '')
    .replace(/\d-\d-\d/g, '')
    .replace(/\bcontrolled\b/g, '')
    .replace(/\bhold\b/g, '')
    .trim();
  const key = cleaned.length > 0 ? cleaned : normalizeToken(blockName ?? '');
  const muscles = new Set<string>();

  if (key.includes('chest')) muscles.add('chest');
  if (key.includes('back') || key.includes('lat')) muscles.add('back');
  if (key.includes('shoulder') || key.includes('delt')) muscles.add('shoulders');
  if (key.includes('triceps') || key.includes('tricep')) muscles.add('triceps');
  if (key.includes('biceps') || key.includes('bicep')) muscles.add('biceps');
  if (key.includes('quad')) muscles.add('quads');
  if (key.includes('hamstring')) muscles.add('hamstrings');
  if (key.includes('glute')) muscles.add('glutes');
  if (key.includes('calf') || key.includes('calves')) muscles.add('calves');
  if (key.includes('core') || key.includes('abs') || key.includes('oblique')) muscles.add('core');
  if (key.includes('forearm')) muscles.add('biceps');
  if (key.includes('leg extension')) muscles.add('quads');
  if (key.includes('leg curl') || key.includes('hamstring curl') || key.includes('nordic')) {
    muscles.add('hamstrings');
  }
  if (key.includes('wood chop') || key.includes('russian twist') || key.includes('crunch') || key.includes('plank') || key.includes('dead bug') || key.includes('ab wheel')) {
    muscles.add('core');
  }
  if (key.includes('row') || key.includes('pulldown') || key.includes('pull-up') || key.includes('pull up') || key.includes('chin-up')) {
    muscles.add('back');
  }
  if (key.includes('lateral raise') || key.includes('overhead press') || key.includes('shoulder press') || key.includes('arnold press')) {
    muscles.add('shoulders');
  }
  if (key.includes('calf raise')) muscles.add('calves');
  if (key.includes('hip thrust') || key.includes('glute bridge')) muscles.add('glutes');
  if (/\bglute kickback\b|\bcable glute kickback\b|\bdonkey kick\b/.test(key)) muscles.add('glutes');
  if (/\btriceps kickback\b|\bcable triceps kickback\b/.test(key)) muscles.add('triceps');
  if (key.includes('lunge') || key.includes('squat') || key.includes('step-up')) muscles.add('quads');

  return [...muscles];
}

function isHeavyCompoundBlock(block: Month1ExerciseBlock, blockIndex: number): boolean {
  if (block.block === 'A' || blockIndex === 0) return true;
  const focus = normalizeToken(block.primaryFocus);
  return (
    focus.includes('squat') ||
    focus.includes('deadlift') ||
    focus.includes('bench') ||
    focus.includes('press') ||
    focus.includes('row') ||
    focus.includes('pull-up') ||
    focus.includes('chin')
  );
}

function scoreRotatedCandidate(
  exercise: ExerciseRecord,
  block: Month1ExerciseBlock,
  blockIndex: number,
  rotationSeed: number,
  recentSlugs: Set<string>,
  usedSlugs: Set<string>,
  blueprintSlug?: string,
): number {
  let score = 10;
  const focusMuscles = parsePrimaryFocusMuscles(block.primaryFocus, block.name);
  if (focusMuscles.length === 0) return -100;

  const matchesFocus = focusMuscles.some((muscle) => exerciseMatchesQuotaMuscle(exercise, muscle));
  if (!matchesFocus) return -100;

  if (usedSlugs.has(exercise.slug)) return -100;
  if (recentSlugs.has(exercise.slug)) score -= 30;

  const family = exercise.metadata?.movement_family ?? '';
  const heavyBlock = isHeavyCompoundBlock(block, blockIndex);

  if (heavyBlock) {
    if (HEAVY_COMPOUND_FAMILIES.has(family)) score += 25;
    else if (family === 'biceps' || family === 'triceps' || family === 'calves') score -= 20;
  } else if (block.block.endsWith('1') || block.block.endsWith('2')) {
    // Superset accessories — favor isolation / cable / dumbbell work
    if (family === 'biceps' || family === 'triceps' || family === 'rear_delt') score += 12;
    if (exercise.equipment === 'cable' || exercise.equipment === 'dumbbell') score += 8;
  }

  if (blueprintSlug && exercise.slug === blueprintSlug) score -= 50;

  const slugHash = exercise.slug.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  score += ((slugHash + rotationSeed * 37 + blockIndex * 13) % 23);

  return score;
}

export function pickRotatedExerciseForBlock(
  block: Month1ExerciseBlock,
  blockIndex: number,
  pool: ExerciseRecord[],
  rotationSeed: number,
  recentSlugs: Set<string>,
  usedSlugs: Set<string>,
  blueprintSlug?: string,
): ExerciseRecord | null {
  const ranked = pool
    .map((exercise) => ({
      exercise,
      score: scoreRotatedCandidate(
        exercise,
        block,
        blockIndex,
        rotationSeed,
        recentSlugs,
        usedSlugs,
        blueprintSlug,
      ),
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.exercise ?? null;
}

export function resolveBlueprintWeek(calendarWeek: number, splitOccurrenceIndex: number): number {
  if (calendarWeek <= 4) return calendarWeek;
  return ((calendarWeek - 1 + splitOccurrenceIndex) % 4) + 1;
}

export function isExactMonth1PrescriptionWeek(calendarWeek: number): boolean {
  return calendarWeek >= 1 && calendarWeek <= 4;
}

/** True when block is a standalone heavy compound (never force into a superset). */
export function isStandaloneCompoundBlock(block: Month1ExerciseBlock, blockIndex: number): boolean {
  return block.block === 'A' || (blockIndex === 0 && isHeavyCompoundBlock(block, blockIndex));
}

export function exerciseAllowedForBlockFocus(
  exercise: ExerciseRecord,
  block: Month1ExerciseBlock,
): boolean {
  const focusMuscles = parsePrimaryFocusMuscles(block.primaryFocus, block.name);
  if (focusMuscles.length === 0) return true;
  if (focusMuscles.includes('core')) return isCoreFocusedExercise(exercise);
  return focusMuscles.some((muscle) => exerciseMatchesQuotaMuscle(exercise, muscle));
}
