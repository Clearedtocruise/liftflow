import { findEquipmentSubstitute } from './equipmentSubstitutionEngine.js';
import {
    exerciseMeetsEquipment,
    expandAvailableEquipment,
    loadAvailableExercises,
    type ExerciseRecord,
} from './workoutPlanner.js';

export type ExerciseAlternativeOption = {
  name: string;
  slug: string;
  muscleGroups: string[];
  equipment: string;
  reason: string;
};

export type ExerciseAlternativesContext = {
  userId: string;
  exerciseName: string;
  muscleGroups?: string[];
  goal?: string;
  programType?: string;
  availableEquipment?: string[];
};

const GOAL_FAMILY_BOOST: Record<string, string[]> = {
  strength: ['squat_pattern', 'hinge_pattern', 'horizontal_press', 'vertical_press', 'horizontal_pull', 'vertical_pull'],
  hypertrophy: ['horizontal_press', 'horizontal_pull', 'squat_pattern', 'hinge_pattern', 'biceps', 'triceps'],
  fat_loss: ['squat_pattern', 'lunge_pattern', 'horizontal_press', 'vertical_pull'],
  general_fitness: ['squat_pattern', 'horizontal_press', 'horizontal_pull', 'core'],
};

const PROGRAM_STYLE_BOOST: Record<string, string[]> = {
  push_pull_legs: ['horizontal_press', 'horizontal_pull', 'squat_pattern'],
  upper_lower: ['horizontal_press', 'vertical_pull', 'squat_pattern'],
  full_body: ['squat_pattern', 'horizontal_press', 'horizontal_pull'],
  bro_split: ['horizontal_press', 'biceps', 'triceps'],
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function findExercise(pool: ExerciseRecord[], name: string): ExerciseRecord | undefined {
  const key = normalizeName(name);
  return pool.find(
    (exercise) =>
      normalizeName(exercise.name) === key ||
      exercise.slug === key.replace(/\s+/g, '-'),
  );
}

function scoreAlternative(
  candidate: ExerciseRecord,
  context: {
    current: ExerciseRecord | undefined;
    muscleGroups: string[];
    goal: string;
    programType: string;
    available: Set<string>;
  },
): number {
  let score = 0;

  if (!exerciseMeetsEquipment(candidate, context.available)) return -1000;

  const currentFamily = context.current?.metadata?.movement_family;
  const candidateFamily = candidate.metadata?.movement_family;
  if (currentFamily && candidateFamily === currentFamily) score += 40;

  const muscleOverlap = candidate.muscle_groups.filter((muscle) =>
    context.muscleGroups.includes(muscle),
  ).length;
  score += muscleOverlap * 12;

  const goalFamilies = GOAL_FAMILY_BOOST[context.goal] ?? GOAL_FAMILY_BOOST.general_fitness;
  if (candidateFamily && goalFamilies.includes(candidateFamily)) score += 8;

  const styleFamilies = PROGRAM_STYLE_BOOST[context.programType] ?? [];
  if (candidateFamily && styleFamilies.includes(candidateFamily)) score += 6;

  if (context.current && normalizeName(candidate.name) === normalizeName(context.current.name)) {
    score -= 1000;
  }

  return score;
}

function buildReason(
  candidate: ExerciseRecord,
  current: ExerciseRecord | undefined,
  goal: string,
  programType: string,
): string {
  const family = candidate.metadata?.movement_family;
  if (current?.metadata?.movement_family && family === current.metadata.movement_family) {
    return `Same movement pattern · ${candidate.equipment} · matches your ${goal.replace(/_/g, ' ')} goal`;
  }
  if (candidate.muscle_groups.length > 0) {
    return `Targets ${candidate.muscle_groups.slice(0, 2).join(' & ')} · ${candidate.equipment} · ${programType.replace(/_/g, ' ')} style`;
  }
  return `Equipment-friendly alternative for your setup`;
}

export async function generateExerciseAlternatives(
  context: ExerciseAlternativesContext,
  limit = 5,
): Promise<{ reasoning: string; alternatives: ExerciseAlternativeOption[] }> {
  const pool = await loadAvailableExercises(context.userId, context.availableEquipment);
  const current = findExercise(pool, context.exerciseName);
  const available = expandAvailableEquipment(context.availableEquipment ?? []);
  const muscleGroups = context.muscleGroups?.length
    ? context.muscleGroups
    : current?.muscle_groups ?? [];
  const goal = context.goal ?? 'general_fitness';
  const programType = context.programType ?? 'full_body';

  const ranked = pool
    .map((candidate) => ({
      candidate,
      score: scoreAlternative(candidate, {
        current,
        muscleGroups,
        goal,
        programType,
        available,
      }),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const alternatives: ExerciseAlternativeOption[] = [];
  const seen = new Set<string>([normalizeName(context.exerciseName)]);

  for (const { candidate } of ranked) {
    const key = normalizeName(candidate.name);
    if (seen.has(key)) continue;
    seen.add(key);
    alternatives.push({
      name: candidate.name,
      slug: candidate.slug,
      muscleGroups: candidate.muscle_groups,
      equipment: candidate.equipment,
      reason: buildReason(candidate, current, goal, programType),
    });
    if (alternatives.length >= limit) break;
  }

  if (alternatives.length < limit) {
    const equipmentSwap = findEquipmentSubstitute(
      context.exerciseName,
      context.availableEquipment ?? [],
      pool,
    );
    if (equipmentSwap) {
      const candidate = findExercise(pool, equipmentSwap.to);
      if (candidate && !seen.has(normalizeName(candidate.name))) {
        alternatives.push({
          name: candidate.name,
          slug: candidate.slug,
          muscleGroups: candidate.muscle_groups,
          equipment: candidate.equipment,
          reason: equipmentSwap.reason,
        });
      }
    }
  }

  while (alternatives.length < limit && alternatives.length < ranked.length) {
    const candidate = ranked[alternatives.length]?.candidate;
    if (!candidate) break;
    const key = normalizeName(candidate.name);
    if (seen.has(key)) continue;
    seen.add(key);
    alternatives.push({
      name: candidate.name,
      slug: candidate.slug,
      muscleGroups: candidate.muscle_groups,
      equipment: candidate.equipment,
      reason: buildReason(candidate, current, goal, programType),
    });
  }

  return {
    reasoning: `Five alternatives for ${context.exerciseName} based on your equipment, ${goal.replace(/_/g, ' ')} goal, ${programType.replace(/_/g, ' ')} training, and target muscles.`,
    alternatives: alternatives.slice(0, limit),
  };
}
