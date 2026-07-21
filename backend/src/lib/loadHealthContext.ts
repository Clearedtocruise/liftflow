import { localDateString } from './localDate.js';
import { requireAdmin } from './supabase.js';
import { buildHealthContextFromRows, type HealthContextSnapshot } from './healthSyncEngine.js';

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const cache = new Map<string, { expiresAt: number; value: HealthContextSnapshot }>();

/** Low-cardinality types only — continuous heart_rate is excluded to protect egress. */
const CONTEXT_DATA_TYPES = [
  'steps',
  'active_calories',
  'sleep',
  'resting_heart_rate',
  'hrv',
  'weight',
  'workout_session',
] as const;

export async function loadHealthContext(userId: string): Promise<HealthContextSnapshot> {
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const db = requireAdmin();
  const { data: profile } = await db.from('profiles').select('timezone').eq('id', userId).maybeSingle();
  const today = localDateString(new Date(), profile?.timezone as string | null | undefined);
  const since = new Date();
  since.setDate(since.getDate() - 14);

  const { data: connection } = await db
    .from('integration_connections')
    .select('is_connected')
    .eq('user_id', userId)
    .eq('provider', 'apple_healthkit')
    .maybeSingle();

  const { data: rows } = await db
    .from('healthkit_sync_records')
    .select('data_type, value, recorded_at')
    .eq('user_id', userId)
    .in('data_type', [...CONTEXT_DATA_TYPES])
    .gte('recorded_at', since.toISOString())
    .order('recorded_at', { ascending: false })
    .limit(500);

  const context = buildHealthContextFromRows(rows ?? [], today);
  context.healthKitAvailable = connection?.is_connected === true || (rows?.length ?? 0) > 0;

  cache.set(userId, { expiresAt: Date.now() + CACHE_TTL_MS, value: context });
  return context;
}

export function invalidateHealthContextCache(userId: string): void {
  cache.delete(userId);
}

export async function applyHealthToRecoveryCheckIn(
  userId: string,
  checkInDate: string,
  context: HealthContextSnapshot,
): Promise<void> {
  if (!context.sleepDataAvailable && context.latestHrvMs == null) return;

  const db = requireAdmin();
  const patch: Record<string, unknown> = {};
  if (context.latestSleepHours != null) patch.sleep_hours = context.latestSleepHours;
  if (context.latestHrvMs != null) patch.hrv_ms = context.latestHrvMs;

  if (Object.keys(patch).length === 0) return;

  await db
    .from('recovery_assessments')
    .update(patch)
    .eq('user_id', userId)
    .eq('check_in_date', checkInDate);
}
