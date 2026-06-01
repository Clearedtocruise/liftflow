/** Server-side health sync merge — mirrors client healthSyncEngine */

export type HealthSampleInput = {
  dataType: string;
  externalId?: string | null;
  value: Record<string, unknown>;
  recordedAt: string;
};

export type StoredHealthRow = HealthSampleInput & {
  id: string;
  user_id: string;
  synced_at: string;
};

export type SyncMergeStats = {
  inserted: number;
  updated: number;
  skipped: number;
  conflicts: number;
};

function sampleKey(sample: Pick<HealthSampleInput, 'dataType' | 'externalId' | 'recordedAt'>): string {
  if (sample.externalId) return `${sample.dataType}:${sample.externalId}`;
  return `${sample.dataType}:${sample.recordedAt}`;
}

export function mergeIncomingHealthSamples(
  existing: StoredHealthRow[],
  incoming: HealthSampleInput[],
): { rows: HealthSampleInput[]; stats: SyncMergeStats } {
  const map = new Map<string, StoredHealthRow>();
  for (const row of existing) {
    map.set(sampleKey(row), row);
  }

  const output: HealthSampleInput[] = [];
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let conflicts = 0;

  for (const sample of incoming) {
    const key = sampleKey(sample);
    const prev = map.get(key);
    if (!prev) {
      output.push(sample);
      inserted += 1;
      continue;
    }
    conflicts += 1;
    const prevTime = new Date(prev.recordedAt).getTime();
    const nextTime = new Date(sample.recordedAt).getTime();
    if (nextTime >= prevTime) {
      output.push(sample);
      updated += 1;
    } else {
      skipped += 1;
    }
  }

  return { rows: output, stats: { inserted, updated, skipped, conflicts } };
}

export type HealthContextSnapshot = {
  healthKitAvailable: boolean;
  sleepDataAvailable: boolean;
  latestSleepHours?: number;
  latestHrvMs?: number;
  latestRestingHeartRate?: number;
  latestWeightKg?: number;
  avgHeartRate7d?: number;
  stepsToday?: number;
  activeCaloriesToday?: number;
};

export function buildHealthContextFromRows(
  rows: Array<{ data_type: string; value: Record<string, unknown>; recorded_at: string }>,
  today: string,
): HealthContextSnapshot {
  const snapshot: HealthContextSnapshot = {
    healthKitAvailable: rows.length > 0,
    sleepDataAvailable: false,
  };

  let hrSum = 0;
  let hrCount = 0;
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  for (const row of rows) {
    const date = row.recorded_at.slice(0, 10);
    switch (row.data_type) {
      case 'sleep':
        snapshot.sleepDataAvailable = true;
        if (date <= today) {
          snapshot.latestSleepHours = Number(row.value.hours ?? row.value.durationHours ?? snapshot.latestSleepHours);
        }
        break;
      case 'hrv':
        snapshot.latestHrvMs = Number(row.value.ms ?? row.value.sdnn ?? snapshot.latestHrvMs);
        break;
      case 'resting_heart_rate':
        snapshot.latestRestingHeartRate = Number(row.value.bpm ?? snapshot.latestRestingHeartRate);
        break;
      case 'weight':
        snapshot.latestWeightKg = Number(row.value.kg ?? snapshot.latestWeightKg);
        break;
      case 'heart_rate':
        if (new Date(row.recorded_at) >= sevenDaysAgo) {
          hrSum += Number(row.value.bpm ?? 0);
          hrCount += 1;
        }
        break;
      case 'steps':
        if (date === today) snapshot.stepsToday = (snapshot.stepsToday ?? 0) + Number(row.value.count ?? 0);
        break;
      case 'active_calories':
        if (date === today) snapshot.activeCaloriesToday = (snapshot.activeCaloriesToday ?? 0) + Number(row.value.kcal ?? 0);
        break;
      default:
        break;
    }
  }

  if (hrCount > 0) snapshot.avgHeartRate7d = Math.round(hrSum / hrCount);
  return snapshot;
}
