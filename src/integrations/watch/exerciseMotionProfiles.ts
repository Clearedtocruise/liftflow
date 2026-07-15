import type { ExerciseMotionProfile } from './types';

/**
 * Motion auto-rep profiles — disabled for now (Watch motion was glitchy).
 * Keep definitions commented in git history; empty list forces no motion matching.
 */
export const EXERCISE_MOTION_PROFILES: ExerciseMotionProfile[] = [];

/** Archived profiles (not used while motion counting is off). */
export const ARCHIVED_EXERCISE_MOTION_PROFILES: ExerciseMotionProfile[] = [
  profile('bench_press', 'Bench Press', ['bench', 'barbell bench', 'flat bench'], 'push', 'magnitude', 900, 4500, 1.35, 0.82),
  profile('dumbbell_press', 'Dumbbell Press', ['db press', 'dumbbell chest press'], 'push', 'magnitude', 900, 4500, 1.3, 0.78),
  profile('bicep_curl', 'Bicep Curls', ['curl', 'bicep curl', 'dumbbell curl'], 'pull', 'axis_y', 700, 3500, 1.25, 0.8),
  profile('shoulder_press', 'Shoulder Press', ['ohp', 'overhead press', 'military press'], 'push', 'magnitude', 900, 4500, 1.35, 0.8),
  profile('tricep_extension', 'Tricep Extensions', ['tricep pushdown', 'skull crusher', 'triceps'], 'push', 'axis_y', 700, 3200, 1.2, 0.74),
  profile('squat', 'Squats', ['back squat', 'barbell squat', 'goblet squat'], 'squat', 'axis_z', 1100, 5500, 1.4, 0.85),
  profile('lunge', 'Lunges', ['walking lunge', 'reverse lunge'], 'squat', 'axis_z', 1000, 5000, 1.35, 0.76),
  profile('leg_extension', 'Leg Extensions', ['quad extension'], 'squat', 'axis_y', 800, 3800, 1.25, 0.77),
  profile('leg_curl', 'Leg Curls', ['hamstring curl', 'lying leg curl'], 'hinge', 'axis_y', 800, 3800, 1.25, 0.77),
  profile('calf_raise', 'Calf Raises', ['standing calf raise', 'seated calf raise'], 'squat', 'axis_z', 600, 2800, 1.15, 0.75),
  profile('row', 'Rows', ['barbell row', 'bent over row', 'cable row', 'seated row'], 'pull', 'magnitude', 900, 4500, 1.3, 0.81),
  profile('lat_pulldown', 'Lat Pulldowns', ['pulldown', 'lat pull'], 'pull', 'magnitude', 900, 4200, 1.3, 0.79),
];

const CONFIDENCE_THRESHOLD = 0.55;

function profile(
  id: string,
  displayName: string,
  aliases: string[],
  movementCategory: ExerciseMotionProfile['movementCategory'],
  signalMode: ExerciseMotionProfile['signalMode'],
  minPeakIntervalMs: number,
  maxPeakIntervalMs: number,
  peakProminence: number,
  baselineConfidence: number,
): ExerciseMotionProfile {
  return {
    id,
    displayName,
    aliases: [displayName.toLowerCase(), ...aliases.map((a) => a.toLowerCase())],
    movementCategory,
    signalMode,
    minPeakIntervalMs,
    maxPeakIntervalMs,
    peakProminence,
    baselineConfidence,
    targetRepsDefault: 8,
    targetSetsDefault: 3,
  };
}

export function resolveExerciseProfile(exerciseName: string): ExerciseMotionProfile | null {
  const normalized = exerciseName.trim().toLowerCase();
  for (const p of EXERCISE_MOTION_PROFILES) {
    if (p.id === normalized || p.displayName.toLowerCase() === normalized) return p;
    if (p.aliases.some((a) => normalized.includes(a) || a.includes(normalized))) return p;
  }
  return null;
}

export function isMotionTrackingSupported(exerciseName: string): boolean {
  return resolveExerciseProfile(exerciseName) !== null;
}

export function getConfidenceThreshold(): number {
  return CONFIDENCE_THRESHOLD;
}

export function listSupportedExerciseNames(): string[] {
  return EXERCISE_MOTION_PROFILES.map((p) => p.displayName);
}
