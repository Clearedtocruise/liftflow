/** Heart rate training zones (1–5) using % of estimated max HR. */

export type HeartRateZone = 1 | 2 | 3 | 4 | 5;

export type HeartRateZoneBucket = {
  zone: HeartRateZone;
  label: string;
  minBpm: number;
  maxBpm: number;
  seconds: number;
};

const ZONE_LABELS: Record<HeartRateZone, string> = {
  1: 'Recovery',
  2: 'Easy',
  3: 'Aerobic',
  4: 'Threshold',
  5: 'Max',
};

/** ACSM-style %HRmax bands. */
const ZONE_FRACTIONS: Array<{ zone: HeartRateZone; min: number; max: number }> = [
  { zone: 1, min: 0.5, max: 0.6 },
  { zone: 2, min: 0.6, max: 0.7 },
  { zone: 3, min: 0.7, max: 0.8 },
  { zone: 4, min: 0.8, max: 0.9 },
  { zone: 5, min: 0.9, max: 1.05 },
];

export function estimateMaxHeartRate(ageYears: number | null | undefined): number {
  const age = ageYears != null && Number.isFinite(ageYears) && ageYears > 0 ? ageYears : 35;
  return Math.round(208 - 0.7 * age);
}

export function ageFromDateOfBirth(dateOfBirth: string | null | undefined, now = new Date()): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  let age = now.getFullYear() - dob.getFullYear();
  const month = now.getMonth() - dob.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age > 0 && age < 120 ? age : null;
}

export function heartRateZoneForBpm(bpm: number, maxHr: number): HeartRateZone {
  const pct = bpm / Math.max(1, maxHr);
  if (pct >= 0.9) return 5;
  if (pct >= 0.8) return 4;
  if (pct >= 0.7) return 3;
  if (pct >= 0.6) return 2;
  return 1;
}

export function buildHeartRateZoneBuckets(
  samples: Array<{ bpm: number; recordedAt?: string }>,
  ageYears?: number | null,
): HeartRateZoneBucket[] {
  const maxHr = estimateMaxHeartRate(ageYears);
  const buckets: HeartRateZoneBucket[] = ZONE_FRACTIONS.map(({ zone, min, max }) => ({
    zone,
    label: ZONE_LABELS[zone],
    minBpm: Math.round(maxHr * min),
    maxBpm: Math.round(maxHr * Math.min(max, 1)),
    seconds: 0,
  }));

  if (samples.length === 0) return buckets;

  const sorted = [...samples].sort((a, b) => {
    const ta = a.recordedAt ? Date.parse(a.recordedAt) : 0;
    const tb = b.recordedAt ? Date.parse(b.recordedAt) : 0;
    return ta - tb;
  });

  for (let i = 0; i < sorted.length; i++) {
    const sample = sorted[i]!;
    const next = sorted[i + 1];
    const duration =
      sample.recordedAt && next?.recordedAt
        ? Math.max(1, Math.min(30, (Date.parse(next.recordedAt) - Date.parse(sample.recordedAt)) / 1000))
        : 3;
    const zone = heartRateZoneForBpm(sample.bpm, maxHr);
    const bucket = buckets.find((row) => row.zone === zone);
    if (bucket) bucket.seconds += duration;
  }

  return buckets;
}

export function supportsPowerMetrics(activityTypeOrLabel: string): boolean {
  const label = activityTypeOrLabel.toLowerCase();
  return (
    label.includes('bike') ||
    label.includes('cycle') ||
    label.includes('row') ||
    label.includes('erg') ||
    label.includes('watt')
  );
}
