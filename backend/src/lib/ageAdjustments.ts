/** Shared age / joint-friendly adjustments for training and nutrition. */

export const JOINT_FRIENDLY_PREF_KEY = 'jointFriendlyTraining';

export type AgeTrainingAdjustments = {
  volumeMultiplier: number;
  intensityMultiplier: number;
  restSecondsBonus: number;
  preferLowImpact: boolean;
};

export type AgeNutritionAdjustments = {
  proteinMultiplier: number;
  /** Softens calorie deficits (e.g. 0.9 means restore 10% of a cut). */
  deficitSoftening: number;
  note: string | null;
};

export function ageYearsFromDateOfBirth(
  dateOfBirth: string | null | undefined,
  now = new Date(),
): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  let age = now.getFullYear() - dob.getFullYear();
  const month = now.getMonth() - dob.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age > 0 && age < 120 ? age : null;
}

/** Age-aware volume/intensity and high-impact filtering for joint-friendlier sessions. */
export function ageTrainingAdjustments(ageYears: number | null | undefined): AgeTrainingAdjustments {
  if (ageYears == null) {
    return { volumeMultiplier: 1, intensityMultiplier: 1, restSecondsBonus: 0, preferLowImpact: false };
  }
  if (ageYears >= 65) {
    return { volumeMultiplier: 0.75, intensityMultiplier: 0.8, restSecondsBonus: 30, preferLowImpact: true };
  }
  if (ageYears >= 55) {
    return { volumeMultiplier: 0.85, intensityMultiplier: 0.9, restSecondsBonus: 15, preferLowImpact: true };
  }
  return { volumeMultiplier: 1, intensityMultiplier: 1, restSecondsBonus: 0, preferLowImpact: false };
}

/**
 * Merge DOB-driven defaults with explicit Settings toggle.
 * - toggle true → always prefer low impact
 * - toggle false with age ≥65 → still prefer low impact (safety default)
 * - toggle explicitly false under 65 → can override 55–64 auto on
 */
export function resolveTrainingAdjustments(
  ageYears: number | null | undefined,
  jointFriendlyPref: boolean | null | undefined,
): AgeTrainingAdjustments {
  const base = ageTrainingAdjustments(ageYears);
  if (jointFriendlyPref === true) {
    return { ...base, preferLowImpact: true };
  }
  if (jointFriendlyPref === false && (ageYears == null || ageYears < 65)) {
    return { ...base, preferLowImpact: false };
  }
  return base;
}

/** Protein-preserving macro tweaks for midlife and older adults (ISSN / ACSM-aligned intent). */
export function ageNutritionAdjustments(ageYears: number | null | undefined): AgeNutritionAdjustments {
  if (ageYears == null || ageYears < 55) {
    return { proteinMultiplier: 1, deficitSoftening: 0, note: null };
  }
  if (ageYears >= 65) {
    return {
      proteinMultiplier: 1.2,
      deficitSoftening: 0.12,
      note: 'Higher protein and a gentler calorie target to support muscle after 65',
    };
  }
  return {
    proteinMultiplier: 1.12,
    deficitSoftening: 0.08,
    note: 'Protein bumped and deficit softened for midlife muscle preservation',
  };
}

const HIGH_IMPACT_SLUG_PATTERN =
  /\b(jump|box-jump|burpee|plyo|kipping|muscle-up|sprint|depth-jump|tuck-jump|broad-jump)\b/i;

export function isHighImpactExercise(exercise: { slug?: string; name?: string }): boolean {
  const label = `${exercise.slug ?? ''} ${exercise.name ?? ''}`;
  return HIGH_IMPACT_SLUG_PATTERN.test(label);
}

export function jointFriendlyTrainingNote(preferLowImpact: boolean): string {
  return preferLowImpact ? ' Joint-friendly selections prioritized (lower impact).' : '';
}
