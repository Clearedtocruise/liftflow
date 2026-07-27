/**
 * Set volume scaled to training experience.
 *
 * The Month 1 blueprint prescribes 4 sets for 95% of its slots — appropriate for someone with years
 * of accumulated work capacity, and far too much for a first-timer. The ACSM position stand on
 * progression models recommends 1–3 sets per exercise for novices (evidence category A), and notes
 * novices reach comparable gains from single- and multiple-set programs.
 *
 * The constraint that matters for a beginner is not the growth ceiling, it is tolerance and
 * adherence. Unaccustomed training spikes soreness and damage markers on first exposure, and those
 * markers fall sharply after two to three repeated sessions (the repeated bout effect). Volume, not
 * load, is the primary driver of that early-phase response. So beginners ramp rather than start at
 * the blueprint's working volume.
 */

export type TrainingExperience = 'beginner' | 'intermediate' | 'advanced' | 'elite';

export type ExperienceVolumeProfile = {
  /** Hard ceiling on working sets for any single exercise. */
  maxSetsPerExercise: number;
  /** Floor so recovery scaling and ramping can never drop an exercise below a useful dose. */
  minSetsPerExercise: number;
  /** Ceiling on exercises per session; keeps a beginner's first sessions finishable. */
  maxExercisesPerSession: number;
  /** Shown to the user so the prescription never looks arbitrary. */
  rationale: string;
};

const BASE_PROFILES: Record<TrainingExperience, Omit<ExperienceVolumeProfile, 'rationale'>> = {
  beginner: { maxSetsPerExercise: 2, minSetsPerExercise: 2, maxExercisesPerSession: 7 },
  intermediate: { maxSetsPerExercise: 3, minSetsPerExercise: 2, maxExercisesPerSession: 9 },
  advanced: { maxSetsPerExercise: 4, minSetsPerExercise: 2, maxExercisesPerSession: 10 },
  elite: { maxSetsPerExercise: 5, minSetsPerExercise: 3, maxExercisesPerSession: 12 },
};

/** Weeks a beginner spends at the entry dose before the cap opens up. */
export const BEGINNER_RAMP_WEEKS = 4;

export function normalizeExperience(value: string | null | undefined): TrainingExperience {
  if (value === 'beginner' || value === 'intermediate' || value === 'advanced' || value === 'elite') {
    return value;
  }
  return 'intermediate';
}

/**
 * Beginners ramp 2 → 3 sets after the acclimation block, which is roughly when the repeated bout
 * effect has blunted the soreness response and technique is no longer the limiting factor. Everyone
 * else sits at their steady-state ceiling.
 */
export function resolveExperienceVolume(
  experience: string | null | undefined,
  weekNumber = 1,
): ExperienceVolumeProfile {
  const level = normalizeExperience(experience);
  const base = BASE_PROFILES[level];

  if (level === 'beginner') {
    const rampedIn = weekNumber > BEGINNER_RAMP_WEEKS;
    return {
      ...base,
      maxSetsPerExercise: rampedIn ? 3 : base.maxSetsPerExercise,
      maxExercisesPerSession: rampedIn ? 8 : base.maxExercisesPerSession,
      rationale: rampedIn
        ? 'Building on your first month — 3 sets per exercise now that the movements are familiar.'
        : `Starting at 2 sets per exercise for your first ${BEGINNER_RAMP_WEEKS} weeks so you can learn the movements and stay consistent.`,
    };
  }

  return {
    ...base,
    rationale:
      level === 'intermediate'
        ? 'Three working sets per exercise, the volume most consistently supported for steady progress.'
        : 'Full working volume — your training history supports it.',
  };
}

/** Applies the experience ceiling without letting an already-light prescription drop further. */
export function capSetsForExperience(sets: number, profile: ExperienceVolumeProfile): number {
  const capped = Math.min(sets, profile.maxSetsPerExercise);
  return Math.max(capped, Math.min(profile.minSetsPerExercise, sets));
}
