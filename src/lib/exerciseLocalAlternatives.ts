import { SYSTEM_EXERCISE_CATALOG, catalogExerciseBySlug } from '@/constants/exerciseDatabase';
import type { ExerciseAlternativeOption } from '@/services/exerciseAdvisoryService';

const NAMED_SUBSTITUTIONS: Record<string, string[]> = {
  'bench press': ['Dumbbell Bench Press', 'Push-Up', 'Incline Bench Press', 'Band Chest Press', 'Cable Fly'],
  'barbell row': ['Dumbbell Row', 'Seated Cable Row', 'Band Row', 'Lat Pulldown'],
  'squat': ['Goblet Squat', 'Front Squat', 'Leg Press', 'Bodyweight Squat'],
  'deadlift': ['Romanian Deadlift', 'Dumbbell Romanian Deadlift', 'Barbell Row'],
  'overhead press': ['Dumbbell Shoulder Press', 'Push-Up'],
  'lat pulldown': ['Pull Up', 'Band Row', 'Dumbbell Row'],
  'pull up': ['Lat Pulldown', 'Band Row', 'Dumbbell Row'],
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function catalogToOption(exercise: (typeof SYSTEM_EXERCISE_CATALOG)[number], reason: string): ExerciseAlternativeOption {
  return {
    name: exercise.name,
    slug: exercise.slug,
    muscleGroups: exercise.muscleGroups,
    equipment: exercise.equipment,
    reason,
  };
}

export function buildLocalExerciseAlternatives(
  exerciseName: string,
  muscleGroups: string[] = [],
  limit = 5,
): ExerciseAlternativeOption[] {
  const key = normalizeName(exerciseName);
  const seen = new Set<string>([key]);
  const options: ExerciseAlternativeOption[] = [];

  for (const [pattern, candidates] of Object.entries(NAMED_SUBSTITUTIONS)) {
    if (key !== pattern && !key.includes(pattern)) continue;
    for (const candidateName of candidates) {
      const slug = candidateName.toLowerCase().replace(/\s+/g, '-');
      const exercise =
        SYSTEM_EXERCISE_CATALOG.find((item) => normalizeName(item.name) === normalizeName(candidateName)) ??
        catalogExerciseBySlug(slug);
      if (!exercise) continue;
      const normalized = normalizeName(exercise.name);
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      options.push(
        catalogToOption(exercise, `Same movement pattern · ${exercise.equipment}`),
      );
      if (options.length >= limit) return options;
    }
  }

  const muscleSet = new Set(muscleGroups.map((muscle) => muscle.toLowerCase()));
  for (const exercise of SYSTEM_EXERCISE_CATALOG) {
    const normalized = normalizeName(exercise.name);
    if (seen.has(normalized)) continue;
    const overlap = exercise.muscleGroups.filter((muscle) => muscleSet.has(muscle.toLowerCase())).length;
    if (overlap === 0 && muscleSet.size > 0) continue;
    seen.add(normalized);
    options.push(
      catalogToOption(
        exercise,
        overlap > 0
          ? `Targets ${exercise.muscleGroups.slice(0, 2).join(' & ')} · ${exercise.equipment}`
          : `Equipment-friendly option · ${exercise.equipment}`,
      ),
    );
    if (options.length >= limit) break;
  }

  return options.slice(0, limit);
}
