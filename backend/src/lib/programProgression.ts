export function estimateOneRepMax(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export function parseRepRange(reps: string): number {
  const match = reps.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 8;
}

export type ProgressionSnapshot = {
  exerciseName: string;
  exerciseSlug?: string;
  weight: number;
  reps: number;
  estimated1Rm: number;
  volume: number;
  weekNumber: number;
};

export function applyWeeklyProgression(
  exercises: Array<{ name: string; sets: number; reps: string; weightLbs?: number; restSeconds: number; notes?: string }>,
  priorPerformance: Map<string, { weight: number; reps: number }>,
  phaseIntensityMultiplier: number,
): typeof exercises {
  return exercises.map((exercise) => {
    const slug = exercise.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const prior = priorPerformance.get(slug);
    let weightLbs = exercise.weightLbs;
    let reps = exercise.reps;

    if (prior) {
      const targetReps = parseRepRange(exercise.reps);
      if (prior.reps >= targetReps) {
        weightLbs = Math.round((prior.weight + 5) * phaseIntensityMultiplier / 5) * 5;
      } else {
        weightLbs = prior.weight;
        reps = `${Math.min(prior.reps + 1, targetReps)}-${targetReps}`;
      }
    }

    const e1rm = weightLbs ? estimateOneRepMax(weightLbs, parseRepRange(reps)) : undefined;

    return {
      ...exercise,
      weightLbs,
      reps,
      notes: [exercise.notes, e1rm ? `Target e1RM ~${e1rm} lb` : undefined].filter(Boolean).join(' · '),
    };
  });
}

export function totalPlannedVolume(
  exercises: Array<{ sets: number; reps: string; weightLbs?: number }>,
): number {
  return exercises.reduce((sum, ex) => {
    const reps = parseRepRange(ex.reps);
    return sum + ex.sets * reps * (ex.weightLbs ?? 0);
  }, 0);
}
