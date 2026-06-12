/** Training goal helpers for backend nutrition + programming (mirrors src/constants/trainingGoals.ts). */

export type NutritionGoal = 'fat_loss' | 'muscle_gain' | 'strength' | 'general_fitness';

export function toNutritionGoal(goal: string | undefined): NutritionGoal {
  switch (goal) {
    case 'fat_loss':
    case 'weight_loss':
      return 'fat_loss';
    case 'muscle_gain':
    case 'hypertrophy':
      return 'muscle_gain';
    case 'strength':
      return 'strength';
    default:
      return 'general_fitness';
  }
}

export function toPlannerGoal(goal: string | undefined): NutritionGoal {
  return toNutritionGoal(goal);
}

export type WorkoutPresetAdjustments = {
  sets: number;
  reps: string;
  restSeconds: number;
  exerciseCount: number;
  includeMobilityFinisher: boolean;
  rationaleTags: string[];
};

export function blendWorkoutPreset(
  base: WorkoutPresetAdjustments,
  rankedGoals: string[],
): WorkoutPresetAdjustments {
  const secondary = rankedGoals.slice(1);
  let { sets, reps, restSeconds, exerciseCount } = base;
  let includeMobilityFinisher = false;
  const rationaleTags: string[] = [];

  if (rankedGoals[0]) {
    rationaleTags.push(rankedGoals[0].replace(/_/g, ' '));
  }

  for (const goal of secondary) {
    rationaleTags.push(goal.replace(/_/g, ' '));
    switch (goal) {
      case 'endurance':
        restSeconds = Math.max(30, restSeconds - 20);
        reps = bumpReps(reps);
        break;
      case 'mobility':
        includeMobilityFinisher = true;
        exerciseCount = Math.min(exerciseCount + 1, 10);
        break;
      case 'strength':
        sets = Math.min(sets + 1, 6);
        reps = lowerReps(reps);
        restSeconds = Math.min(restSeconds + 30, 180);
        break;
      case 'hypertrophy':
      case 'muscle_gain':
        sets = Math.min(sets + 1, 6);
        reps = '8-12';
        break;
      case 'fat_loss':
      case 'weight_loss':
        restSeconds = Math.max(45, restSeconds - 15);
        reps = bumpReps(reps);
        break;
      default:
        break;
    }
  }

  return { sets, reps, restSeconds, exerciseCount, includeMobilityFinisher, rationaleTags };
}

function bumpReps(reps: string): string {
  if (reps.includes('4-6')) return '6-10';
  if (reps.includes('8-12')) return '10-15';
  if (reps.includes('10-12')) return '12-15';
  return reps;
}

function lowerReps(reps: string): string {
  if (reps.includes('12-15')) return '8-12';
  if (reps.includes('10-12')) return '6-10';
  if (reps.includes('8-12')) return '4-6';
  return reps;
}

export function resolveRankedGoals(fitnessGoals: string[] | null | undefined, primaryFallback?: string | null): string[] {
  if (fitnessGoals?.length) return fitnessGoals;
  if (primaryFallback) return [primaryFallback];
  return ['general_fitness'];
}
