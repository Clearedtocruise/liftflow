import {
    exerciseMeetsEquipment,
    expandAvailableEquipment,
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
const TRICEPS_FREEWEIGHT_SUBS = [
  'EZ-Bar Skull Crusher',
  'Skull Crusher',
  'Dumbbell Overhead Triceps Extension',
  'Overhead Triceps Extension',
  'Close-Grip Bench Press',
  'Bench Dip',
] as const;

const CHEST_CABLE_SUBS = [
  'Dumbbell Fly',
  'Incline Dumbbell Press',
  'Dumbbell Bench Press',
  'Push-Up',
] as const;

const SHOULDER_CABLE_SUBS = [
  'Dumbbell Lateral Raise',
  'Reverse Fly',
  'Dumbbell Rear Delt Fly',
] as const;

const NAMED_SUBSTITUTIONS: Record<string, readonly string[]> = {
  'cable fly': CHEST_CABLE_SUBS,
  'cable crossover': CHEST_CABLE_SUBS,
  'high cable fly': CHEST_CABLE_SUBS,
  'low-to-high cable fly': CHEST_CABLE_SUBS,
  'incline cable press': ['Incline Dumbbell Press', 'Dumbbell Bench Press', 'Push-Up'],
  'single-arm cable press': ['Incline Dumbbell Press', 'Dumbbell Bench Press'],
  'lat pulldown': ['Pull Up', 'Band Row'],
  'seated cable row': ['Dumbbell Row', 'Band Row', 'Barbell Row'],
  'rope triceps pushdown': TRICEPS_FREEWEIGHT_SUBS,
  'triceps pushdown': TRICEPS_FREEWEIGHT_SUBS,
  'tricep pushdown': TRICEPS_FREEWEIGHT_SUBS,
  'overhead rope triceps extension': TRICEPS_FREEWEIGHT_SUBS,
  'rope overhead triceps extension': TRICEPS_FREEWEIGHT_SUBS,
  'single-arm cable triceps extension': TRICEPS_FREEWEIGHT_SUBS,
  'cross-body cable triceps extension': TRICEPS_FREEWEIGHT_SUBS,
  'cable triceps kickback': ['Dumbbell Overhead Triceps Extension', 'Skull Crusher'],
  'reverse-grip triceps pushdown': TRICEPS_FREEWEIGHT_SUBS,
  'leg press': ['Goblet Squat', 'Bodyweight Squat', 'Walking Lunge'],
  'hack squat': ['Goblet Squat', 'Bodyweight Squat'],
  'leg extension': ['Goblet Squat', 'Bodyweight Squat', 'Walking Lunge', 'Bulgarian Split Squat'],
  'seated leg curl': ['Romanian Deadlift', 'Dumbbell Romanian Deadlift', 'Glute Bridge'],
  'lying leg curl': ['Romanian Deadlift', 'Dumbbell Romanian Deadlift', 'Glute Bridge'],
  'leg curl': ['Romanian Deadlift', 'Dumbbell Romanian Deadlift', 'Glute Bridge'],
  'pec deck': CHEST_CABLE_SUBS,
  'reverse pec deck': SHOULDER_CABLE_SUBS,
  'reverse pec': SHOULDER_CABLE_SUBS,
  'face pull': SHOULDER_CABLE_SUBS,
  'cable y-raise': SHOULDER_CABLE_SUBS,
  'cable lateral raise': ['Dumbbell Lateral Raise', 'Band Lateral Raise'],
  'lean-away cable lateral raise': ['Dumbbell Lateral Raise'],
  'cable wood chop': ['Russian Twist', 'Dead Bug', 'Plank'],
  'cable crunch': ['Crunch', 'Dead Bug', 'Plank'],
  'cable glute kickback': ['Glute Bridge', 'Hip Thrust', 'Dumbbell Romanian Deadlift'],
  'glute kickback': ['Glute Bridge', 'Hip Thrust', 'Dumbbell Romanian Deadlift'],
  'ab wheel rollout': ['Plank', 'Dead Bug', 'Crunch'],
  'bench press': ['Dumbbell Bench Press', 'Push-Up'],
  'barbell row': ['Dumbbell Row', 'Band Row'],
  'overhead press': ['Dumbbell Shoulder Press', 'Seated Dumbbell Shoulder Press'],
  'squat': ['Goblet Squat', 'Bodyweight Squat'],
  'deadlift': ['Dumbbell Romanian Deadlift'],
  'romanian deadlift': ['Dumbbell Romanian Deadlift'],
  'pull up': ['Pull Up', 'Band Row'],
  'pull-up': ['Pull Up', 'Band Row'],
};

function tryNamedCandidates(
  candidates: readonly string[],
  available: Set<string>,
  pool: ExerciseRecord[],
  from: string,
  reason: string,
  hasBands: boolean,
): EquipmentSwap | null {
  for (const candidateName of candidates) {
    const candidate = findExerciseByName(pool, candidateName);
    if (!candidate || !exerciseMeetsEquipment(candidate, available)) continue;
    if (!hasBands && (candidate.equipment === 'bands' || candidate.slug.startsWith('band-'))) continue;
    return { from, to: candidate.name, reason };
  }
  return null;
}

function isTricepsCableExercise(key: string): boolean {
  if (/\bglute kickback\b|\bcable glute kickback\b|\bdonkey kick\b/.test(key)) return false;
  return (
    /\brope\b/.test(key) ||
    /\bpushdown\b/.test(key) ||
    /\btriceps extension\b/.test(key) ||
    /\btricep extension\b/.test(key) ||
    /\btriceps kickback\b/.test(key) ||
    (/\bkickback\b/.test(key) && /\btriceps\b/.test(key))
  );
}

function isChestCableExercise(key: string): boolean {
  return /\bfly\b|\bcrossover\b|\bpec deck\b|\bcable press\b/i.test(key);
}

function isShoulderCableExercise(key: string): boolean {
  return /\bface pull\b|\by-raise\b|\blateral raise\b|\breverse pec\b|\brear delt\b/i.test(key);
}

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
  const hasBands = available.has('bands');

  function candidateAllowed(candidate: ExerciseRecord): boolean {
    if (!exerciseMeetsEquipment(candidate, available)) return false;
    if (!hasBands && (candidate.equipment === 'bands' || candidate.slug.startsWith('band-'))) {
      return false;
    }
    return true;
  }

  const current = findExerciseByName(pool, exerciseName);
  if (current && candidateAllowed(current)) {
    return null;
  }

  const key = normalizeName(exerciseName);

  if (isTricepsCableExercise(key)) {
    const swap = tryNamedCandidates(
      TRICEPS_FREEWEIGHT_SUBS,
      available,
      pool,
      exerciseName,
      'No cable/rope — using dumbbell or EZ-bar triceps option',
      hasBands,
    );
    if (swap) return swap;
  }

  if (/\bcable\b/.test(key) || /\brope\b/.test(key)) {
    if (isChestCableExercise(key)) {
      const swap = tryNamedCandidates(
        CHEST_CABLE_SUBS,
        available,
        pool,
        exerciseName,
        'No cable — using dumbbell or bodyweight chest option',
        hasBands,
      );
      if (swap) return swap;
    }
    if (isShoulderCableExercise(key)) {
      const swap = tryNamedCandidates(
        SHOULDER_CABLE_SUBS,
        available,
        pool,
        exerciseName,
        'No cable — using dumbbell shoulder option',
        hasBands,
      );
      if (swap) return swap;
    }
    if (/\bwood chop\b|\bcrunch\b|\bpallof\b|\banti-rotation\b|\blift\b/i.test(key)) {
      const swap = tryNamedCandidates(
        ['Russian Twist', 'Dead Bug', 'Plank', 'Crunch'],
        available,
        pool,
        exerciseName,
        'Swapped to bodyweight core option',
        hasBands,
      );
      if (swap) return swap;
    }
  }

  if (/\bkettlebell\b|\bkb\b/.test(key)) {
    for (const candidateName of ['Dumbbell Curl', 'Hammer Curl', 'Dumbbell Row', 'Goblet Squat', 'Dumbbell Shoulder Press']) {
      const candidate = findExerciseByName(pool, candidateName);
      if (candidate && candidateAllowed(candidate)) {
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
        if (candidate && candidateAllowed(candidate)) {
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
  const backPullFamilies = new Set(['horizontal_pull', 'vertical_pull']);
  const isPushPattern =
    /\bbench\b|\bfly\b|\bpress\b|\bpush-up\b|\bpushdown\b|\btriceps\b|\bdip\b|\bpec\b|\bshoulder\b|\bchest\b/i.test(
      key,
    );
  const isLegExercise = /\bleg\b|\bquad\b|\bhamstring\b|\bglute\b|\bcalf\b|\blunge\b|\bsquat\b|\bdeadlift\b|\bhip thrust\b/i.test(key);
  if (family && !(isLegExercise && backPullFamilies.has(family)) && !(isPushPattern && backPullFamilies.has(family))) {
    const matches = pool.filter(
      (exercise) =>
        exercise.metadata?.movement_family === family &&
        candidateAllowed(exercise) &&
        normalizeName(exercise.name) !== key &&
        !/\bglute kickback\b/i.test(exercise.name),
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
