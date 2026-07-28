const LB_PER_KG = 2.2046226218;

/**
 * Reject plan/coach working weights that are physically implausible for the movement.
 * Target Performance used to echo the live stepper (or a bad plan suggestion), which is how a
 * Plate Curl could show something like 175 lb with no history for that exercise.
 */
export function isPlausibleWorkingWeightKg(
  exerciseName: string | undefined | null,
  weightKg: number | undefined | null,
): weightKg is number {
  if (weightKg == null || !(weightKg > 0) || !Number.isFinite(weightKg)) return false;
  const name = (exerciseName ?? '').toLowerCase();
  const weightLbs = weightKg * LB_PER_KG;

  if (/\bplate\b/.test(name) && /\bcurl\b/.test(name)) return weightLbs <= 55;
  if (/\b(curl|raise|fly|flye|kickback|extension|shrug)\b/.test(name)) return weightLbs <= 80;
  if (/\b(lateral|rear delt|tricep|bicep)\b/.test(name)) return weightLbs <= 80;
  return weightLbs <= 600;
}
