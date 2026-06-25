import {
  expandAvailableEquipment,
  exerciseMeetsEquipment,
  type ExerciseRecord,
} from './workoutPlanner.js';

export type PlannedExerciseRow = {
  name: string;
  sets: number;
  reps: string;
  weightLbs?: number;
  restSeconds: number;
  notes?: string;
};

export type EquipmentSwap = {
  from: string;
  to: string;
  reason: string;
};

/** Preferred substitutes for common equipment-dependent exercises (Sprint 7 spec). */
const NAMED_SUBSTITUTIONS: Record<string, string[]> = {
  'cable fly': ['Push-Up', 'Dumbbell Bench Press', 'Band Chest Press'],
  'lat pulldown': ['Pull Up', 'Band Row', 'Dumbbell Row'],
  'seated cable row': ['Dumbbell Row', 'Band Row', 'Barbell Row'],
  'tricep pushdown': ['Push-Up', 'Dumbbell Bench Press'],
  'leg press': ['Goblet Squat', 'Bodyweight Squat', 'Walking Lunge'],
  'hack squat': ['Goblet Squat', 'Bodyweight Squat'],
  'leg extension': ['Goblet Squat', 'Bodyweight Squat', 'Walking Lunge', 'Bulgarian Split Squat'],
  'seated leg curl': ['Romanian Deadlift', 'Dumbbell Romanian Deadlift', 'Glute Bridge'],
  'lying leg curl': ['Romanian Deadlift', 'Dumbbell Romanian Deadlift', 'Glute Bridge'],
  'leg curl': ['Romanian Deadlift', 'Dumbbell Romanian Deadlift', 'Glute Bridge'],
  'pec deck': ['Dumbbell Fly', 'Push-Up', 'Band Chest Press'],
  'cable wood chop': ['Russian Twist', 'Dead Bug', 'Plank'],
  'cable crunch': ['Crunch', 'Dead Bug', 'Plank'],
  'ab wheel rollout': ['Plank', 'Dead Bug', 'Crunch'],
  'bench press': ['Dumbbell Bench Press', 'Push-Up', 'Band Chest Press'],
  'barbell row': ['Dumbbell Row', 'Band Row'],
  'overhead press': ['Dumbbell Shoulder Press', 'Push-Up'],
  'squat': ['Goblet Squat', 'Bodyweight Squat'],
  'deadlift': ['Dumbbell Romanian Deadlift', 'Dumbbell Row'],
  'romanian deadlift': ['Dumbbell Romanian Deadlift'],
  'pull up': ['Lat Pulldown', 'Band Row', 'Dumbbell Row'],
  'pull-up': ['Lat Pulldown', 'Band Row', 'Dumbbell Row'],
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function findExerciseByName(pool: ExerciseRecord[], name: string): ExerciseRecord | undefined {
  const normalized = normalizeName(name);
  return pool.find(
    (exercise) =>
      normalizeName(exercise.name) === normalized ||
      exercise.slug === normalized.replace(/\s+/g, '-'),
  );
}

export function findEquipmentSubstitute(
  exerciseName: string,
  availableEquipment: string[],
  pool: ExerciseRecord[],
): EquipmentSwap | null {
  const available = expandAvailableEquipment(availableEquipment);
  const current = findExerciseByName(pool, exerciseName);
  if (current && exerciseMeetsEquipment(current, available)) {
    return null;
  }

  const key = normalizeName(exerciseName);
  if (/\bkettlebell\b|\bkb\b/.test(key)) {
    for (const candidateName of ['Dumbbell Curl', 'Hammer Curl', 'Dumbbell Row', 'Goblet Squat', 'Dumbbell Shoulder Press']) {
      const candidate = findExerciseByName(pool, candidateName);
      if (candidate && exerciseMeetsEquipment(candidate, available)) {
        return {
          from: exerciseName,
          to: candidate.name,
          reason: `Swapped to ${candidate.name} for your available equipment`,
        };
      }
    }
  }
  if (/\bcable\b/.test(key)) {
    const coreCable =
      /\bwood chop\b|\bcrunch\b|\bpallof\b|\banti-rotation\b|\blift\b/i.test(key);
    const candidates = coreCable
      ? ['Russian Twist', 'Dead Bug', 'Plank', 'Crunch']
      : ['Band Row', 'Push-Up', 'Band Chest Press'];
    for (const candidateName of candidates) {
      const candidate = findExerciseByName(pool, candidateName);
      if (candidate && exerciseMeetsEquipment(candidate, available)) {
        return {
          from: exerciseName,
          to: candidate.name,
          reason: `Swapped to ${candidate.name} for your available equipment`,
        };
      }
    }
  }

  for (const [pattern, candidates] of Object.entries(NAMED_SUBSTITUTIONS)) {
    if (key === pattern || key.includes(pattern)) {
      for (const candidateName of candidates) {
        const candidate = findExerciseByName(pool, candidateName);
        if (candidate && exerciseMeetsEquipment(candidate, available)) {
          return {
            from: exerciseName,
            to: candidate.name,
            reason: `Equipment unavailable — swapped to ${candidate.name}`,
          };
        }
      }
    }
  }

  const family = current?.metadata?.movement_family;
  const backPullFamilies = new Set(['horizontal_pull', 'vertical_pull', 'biceps']);
  const isLegExercise = /\bleg\b|\bquad\b|\bhamstring\b|\bglute\b|\bcalf\b|\blunge\b|\bsquat\b|\bdeadlift\b|\bhip thrust\b/i.test(key);
  if (family && !(isLegExercise && backPullFamilies.has(family))) {
    const matches = pool.filter(
      (exercise) =>
        exercise.metadata?.movement_family === family &&
        exerciseMeetsEquipment(exercise, available) &&
        normalizeName(exercise.name) !== key,
    );
    if (matches.length > 0) {
      const best = matches[0];
      return {
        from: exerciseName,
        to: best.name,
        reason: `Same movement pattern (${family}) for your equipment`,
      };
    }
  }

  return null;
}

export function applyEquipmentSubstitutionsToExercises<T extends PlannedExerciseRow>(
  exercises: T[],
  availableEquipment: string[],
  pool: ExerciseRecord[],
): { exercises: T[]; swaps: EquipmentSwap[] } {
  const swaps: EquipmentSwap[] = [];
  const updated = exercises.map((exercise) => {
    const swap = findEquipmentSubstitute(exercise.name, availableEquipment, pool);
    if (!swap) return exercise;
    swaps.push(swap);
    return {
      ...exercise,
      name: swap.to,
      notes: [exercise.notes, swap.reason].filter(Boolean).join(' · '),
    };
  });
  return { exercises: updated, swaps };
}
