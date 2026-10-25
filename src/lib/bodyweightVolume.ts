const MIN_BODY_WEIGHT_KG = 35;
const MAX_BODY_WEIGHT_KG = 250;

/**
 * Share of body weight each rep moves, from published force-plate and EMG studies (push-up ≈ 64%,
 * knee push-up ≈ 49%, incline ≈ 41–55%, decline ≈ 70%). First match wins, so the more specific
 * variant must come before its base movement. A movement not listed here counts nothing rather
 * than a guess.
 */
const BODYWEIGHT_SHARES: ReadonlyArray<readonly [RegExp, number]> = [
  [/\bdecline\b.*\bpush[\s-]*ups?\b|\bfeet[\s-]*elevated\b.*\bpush[\s-]*ups?\b/i, 0.7],
  [/\b(incline|hands?[\s-]*elevated)\b.*\bpush[\s-]*ups?\b/i, 0.45],
  [/\bknee(ling)?\b.*\bpush[\s-]*ups?\b/i, 0.49],
  [/\bpush[\s-]*ups?\b|\bpress[\s-]*ups?\b/i, 0.64],
  [/\bburpees?\b/i, 0.64],
  [/\b(pull|chin|muscle)[\s-]*ups?\b/i, 1],
  [/\bbench[\s-]*dips?\b/i, 0.5],
  [/\bdips?\b/i, 0.95],
  [/\binverted[\s-]*rows?\b|\baustralian[\s-]*pull[\s-]*ups?\b/i, 0.55],
  [/\b(flat|lying)\b.*\bpull[\s-]*downs?\b/i, 0.55],
  [/\bcalf[\s-]*raises?\b/i, 1],
  [/\b(air|bodyweight|pistol)[\s-]*squats?\b|\blunges?\b|\bsplit[\s-]*squats?\b|\bstep[\s-]*ups?\b/i, 0.8],
  [/\bglute[\s-]*bridges?\b|\bhip[\s-]*thrusts?\b/i, 0.5],
  [/\bsit[\s-]*ups?\b/i, 0.6],
  [/\bcrunch(es)?\b/i, 0.4],
  [
    /\bleg[\s-]*raises?\b|\bv[\s-]*ups?\b|\btoes[\s-]*to[\s-]*bar\b|\b(flutter|scissor)[\s-]*kicks?\b|\bthrow[\s-]*downs?\b|\bwindshield[\s-]*wipers?\b/i,
    0.32,
  ],
  [/\brussian[\s-]*twists?\b/i, 0.3],
  [/\bdead[\s-]*bugs?\b/i, 0.2],
];

export function bodyweightShare(exerciseName: string | null | undefined): number {
  const name = exerciseName?.trim() ?? '';
  if (!name) return 0;
  for (const [pattern, share] of BODYWEIGHT_SHARES) {
    if (pattern.test(name)) return share;
  }
  return 0;
}

export function knownBodyWeightKg(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw)) return null;
  return raw >= MIN_BODY_WEIGHT_KG && raw <= MAX_BODY_WEIGHT_KG ? raw : null;
}

/**
 * Load one rep of a bodyweight movement moves: the athlete's share of body weight plus any weight
 * they added (a weighted vest or dip belt). An unknown body weight counts only the added weight.
 */
export function bodyweightSetLoadKg(
  exerciseName: string | null | undefined,
  bodyWeightKg: number | null | undefined,
  addedKg?: number | null,
): number {
  const added = addedKg && addedKg > 0 ? addedKg : 0;
  const bw = knownBodyWeightKg(bodyWeightKg);
  const fromBody = bw == null ? 0 : bw * bodyweightShare(exerciseName);
  return Math.round((fromBody + added) * 10) / 10;
}

export type VolumeSet = {
  isBodyweight: boolean;
  exerciseName?: string | null;
  weightKg?: number | null;
  reps?: number | null;
};

export function setVolumeKg(set: VolumeSet, bodyWeightKg: number | null | undefined): number {
  const reps = set.reps && set.reps > 0 ? set.reps : 0;
  if (!reps) return 0;
  if (set.isBodyweight) return bodyweightSetLoadKg(set.exerciseName, bodyWeightKg, set.weightKg) * reps;
  return set.weightKg && set.weightKg > 0 ? set.weightKg * reps : 0;
}
