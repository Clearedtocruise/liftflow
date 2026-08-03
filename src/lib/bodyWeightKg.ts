/** Classic lbs↔kg inversion: ~180 lb stored as ~400 kg (×2.2 instead of ÷2.2). */
const LB_PER_KG = 2.20462;
const MIN_BODY_WEIGHT_KG = 35;
const MAX_BODY_WEIGHT_KG = 250;

export function normalizeBodyWeightKg(raw: number | null | undefined): number {
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return 75;

  if (raw >= 300 && raw <= 550) {
    const trueKg = raw / (LB_PER_KG * LB_PER_KG);
    if (trueKg >= MIN_BODY_WEIGHT_KG && trueKg <= MAX_BODY_WEIGHT_KG) {
      return Math.round(trueKg * 10) / 10;
    }
  }

  if (raw > MAX_BODY_WEIGHT_KG) {
    const asSingleConversion = raw / LB_PER_KG;
    if (asSingleConversion >= MIN_BODY_WEIGHT_KG && asSingleConversion <= MAX_BODY_WEIGHT_KG) {
      return Math.round(asSingleConversion * 10) / 10;
    }
    return MAX_BODY_WEIGHT_KG;
  }

  if (raw < MIN_BODY_WEIGHT_KG) return MIN_BODY_WEIGHT_KG;
  return raw;
}

export function isInvertedBodyWeightKg(raw: number | null | undefined): boolean {
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return false;
  return Math.abs(normalizeBodyWeightKg(raw) - raw) > 1;
}
