import type { HealthMetricSample } from '@/integrations/types';
import type { HealthSyncConflictPolicy } from '@/integrations/healthConstants';

export type StoredHealthSample = {
  id?: string;
  userId: string;
  dataType: string;
  externalId?: string | null;
  value: Record<string, unknown>;
  recordedAt: string;
  syncedAt?: string;
  source?: string;
};

export type SyncMergeResult = {
  inserted: number;
  updated: number;
  skipped: number;
  conflicts: number;
};

function sampleKey(sample: Pick<HealthMetricSample, 'dataType' | 'externalId' | 'recordedAt'>): string {
  if (sample.externalId) return `${sample.dataType}:${sample.externalId}`;
  return `${sample.dataType}:${sample.recordedAt}`;
}

/** Resolve whether incoming sample should replace existing row */
export function resolveHealthConflict(
  existing: StoredHealthSample,
  incoming: HealthMetricSample,
  policy: HealthSyncConflictPolicy = 'latest_wins',
): 'keep' | 'replace' {
  const existingSource = existing.source ?? 'unknown';
  const incomingSource = (incoming.value.provider as string | undefined) ?? 'apple_healthkit';

  if (policy === 'healthkit_wins') {
    if (incomingSource.includes('health') || incomingSource.includes('healthkit')) return 'replace';
    if (existingSource.includes('health') || existingSource.includes('healthkit')) return 'keep';
  }

  if (policy === 'manual_wins') {
    if (incomingSource === 'manual') return 'replace';
    if (existingSource === 'manual') return 'keep';
  }

  const existingTime = new Date(existing.recordedAt).getTime();
  const incomingTime = new Date(incoming.recordedAt).getTime();
  return incomingTime >= existingTime ? 'replace' : 'keep';
}

/** Merge incoming batch against existing records — dedupe before DB write */
export function mergeHealthSamples(
  existing: StoredHealthSample[],
  incoming: HealthMetricSample[],
  userId: string,
  provider: string,
  policy: HealthSyncConflictPolicy = 'latest_wins',
): { toInsert: StoredHealthSample[]; toUpdate: StoredHealthSample[]; result: SyncMergeResult } {
  const existingByKey = new Map<string, StoredHealthSample>();
  for (const row of existing) {
    existingByKey.set(sampleKey(row), row);
  }

  const toInsert: StoredHealthSample[] = [];
  const toUpdate: StoredHealthSample[] = [];
  let skipped = 0;
  let conflicts = 0;

  for (const sample of incoming) {
    const key = sampleKey(sample);
    const stored: StoredHealthSample = {
      userId,
      dataType: sample.dataType,
      externalId: sample.externalId ?? null,
      value: { ...sample.value, provider, unit: sample.unit },
      recordedAt: sample.recordedAt,
      syncedAt: new Date().toISOString(),
      source: provider,
    };

    const prev = existingByKey.get(key);
    if (!prev) {
      toInsert.push(stored);
      existingByKey.set(key, stored);
      continue;
    }

    conflicts += 1;
    const decision = resolveHealthConflict(prev, sample, policy);
    if (decision === 'replace') {
      toUpdate.push({ ...stored, id: prev.id });
      existingByKey.set(key, { ...stored, id: prev.id });
    } else {
      skipped += 1;
    }
  }

  return {
    toInsert,
    toUpdate,
    result: {
      inserted: toInsert.length,
      updated: toUpdate.length,
      skipped,
      conflicts,
    },
  };
}

export type HealthDailySummary = {
  date: string;
  steps?: number;
  activeCalories?: number;
  sleepHours?: number;
  restingHeartRate?: number;
  hrvMs?: number;
  weightKg?: number;
  avgHeartRate?: number;
  workoutCount?: number;
};

/** Aggregate synced samples into daily summaries for recovery scoring */
export function summarizeHealthByDay(samples: StoredHealthSample[]): HealthDailySummary[] {
  const byDate = new Map<string, HealthDailySummary>();

  function dayOf(iso: string): string {
    return iso.slice(0, 10);
  }

  function ensure(date: string): HealthDailySummary {
    let row = byDate.get(date);
    if (!row) {
      row = { date };
      byDate.set(date, row);
    }
    return row;
  }

  for (const s of samples) {
    const date = dayOf(s.recordedAt);
    const row = ensure(date);
    switch (s.dataType) {
      case 'steps':
        row.steps = (row.steps ?? 0) + Number(s.value.count ?? 0);
        break;
      case 'active_calories':
        row.activeCalories = (row.activeCalories ?? 0) + Number(s.value.kcal ?? 0);
        break;
      case 'sleep':
        row.sleepHours = (row.sleepHours ?? 0) + Number(s.value.hours ?? s.value.durationHours ?? 0);
        break;
      case 'resting_heart_rate':
        row.restingHeartRate = Number(s.value.bpm ?? row.restingHeartRate);
        break;
      case 'hrv':
        row.hrvMs = Number(s.value.ms ?? s.value.sdnn ?? row.hrvMs);
        break;
      case 'weight':
        row.weightKg = Number(s.value.kg ?? row.weightKg);
        break;
      case 'heart_rate':
        row.avgHeartRate = Number(s.value.bpm ?? row.avgHeartRate);
        break;
      case 'workout_session':
        row.workoutCount = (row.workoutCount ?? 0) + 1;
        break;
      default:
        break;
    }
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
