/** Training goals — multi-select with priority order (index 0 = highest). */

export const TRAINING_GOAL_OPTIONS = [
  { id: 'fat_loss', label: 'Fat loss', description: 'Calorie deficit, higher reps, shorter rest' },
  { id: 'muscle_gain', label: 'Muscle gain', description: 'Hypertrophy-focused volume and protein' },
  { id: 'hypertrophy', label: 'Hypertrophy', description: 'Muscle size — volume and time under tension' },
  { id: 'strength', label: 'Strength', description: 'Heavy loads, lower reps, longer rest' },
  { id: 'endurance', label: 'Endurance', description: 'Cardio capacity and muscular endurance' },
  { id: 'mobility', label: 'Mobility', description: 'Flexibility, joint health, movement quality' },
  { id: 'general_fitness', label: 'Performance', description: 'Balanced athletic performance' },
  { id: 'weight_loss', label: 'Weight loss', description: 'Scale-focused deficit (alias fat loss)' },
] as const;

export type TrainingGoalId = (typeof TRAINING_GOAL_OPTIONS)[number]['id'];

export type NutritionGoal = 'fat_loss' | 'muscle_gain' | 'strength' | 'general_fitness';

export type PlannerGoal = NutritionGoal;

/** Quick-apply common goal combinations (order = priority). */
export const GOAL_COMBINATION_PRESETS = [
  {
    id: 'recomp',
    label: 'Fat loss + muscle',
    goals: ['fat_loss', 'muscle_gain'] as TrainingGoalId[],
  },
  {
    id: 'strength_hypertrophy',
    label: 'Strength + hypertrophy',
    goals: ['strength', 'hypertrophy'] as TrainingGoalId[],
  },
  {
    id: 'endurance_weight_loss',
    label: 'Endurance + weight loss',
    goals: ['endurance', 'weight_loss'] as TrainingGoalId[],
  },
  {
    id: 'mobility_performance',
    label: 'Mobility + performance',
    goals: ['mobility', 'general_fitness'] as TrainingGoalId[],
  },
] as const;

const GOAL_LABELS = new Map(TRAINING_GOAL_OPTIONS.map((g) => [g.id, g.label]));

export function getTrainingGoalLabel(id: string): string {
  return GOAL_LABELS.get(id as TrainingGoalId) ?? id.replace(/_/g, ' ');
}

/** Highest-priority goal drives calorie / macro targets. */
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

/** Map any goal id to planner preset key. */
export function toPlannerGoal(goal: string | undefined): PlannerGoal {
  return toNutritionGoal(goal);
}

export function summarizeGoals(ranked: string[]): string {
  if (ranked.length === 0) return 'None selected';
  if (ranked.length === 1) return getTrainingGoalLabel(ranked[0]);
  return ranked.map((id, i) => `${i + 1}. ${getTrainingGoalLabel(id)}`).join(' · ');
}

export type WorkoutPresetAdjustments = {
  sets: number;
  reps: string;
  restSeconds: number;
  exerciseCount: number;
  includeMobilityFinisher: boolean;
  rationaleTags: string[];
};

/** Blend primary + secondary goals into workout prescription adjustments. */
export function blendWorkoutPreset(
  base: WorkoutPresetAdjustments,
  rankedGoals: string[],
): WorkoutPresetAdjustments {
  const primary = rankedGoals[0];
  const secondary = rankedGoals.slice(1);
  let { sets, reps, restSeconds, exerciseCount } = base;
  let includeMobilityFinisher = false;
  const rationaleTags: string[] = [];

  if (primary) rationaleTags.push(getTrainingGoalLabel(primary));

  for (const goal of secondary) {
    rationaleTags.push(getTrainingGoalLabel(goal));
    switch (goal) {
      case 'endurance':
        restSeconds = Math.max(30, restSeconds - 20);
        reps = bumpReps(reps);
        break;
      case 'mobility':
        includeMobilityFinisher = true;
        exerciseCount = Math.min(exerciseCount + 1, 7);
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
      case 'general_fitness':
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

/** Legacy export for trainingProfile */
export const TRAINING_GOALS = TRAINING_GOAL_OPTIONS.map(({ id, label }) => ({ id, label }));
