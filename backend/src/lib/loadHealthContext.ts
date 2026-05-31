import { requireAdmin } from './supabase.js';
import { buildHealthContextFromRows, type HealthContextSnapshot } from './healthSyncEngine.js';

export async function loadHealthContext(userId: string): Promise<HealthContextSnapshot> {
  const db = requireAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const since = new Date();
  since.setDate(since.getDate() - 30);

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
    .gte('recorded_at', since.toISOString())
    .order('recorded_at', { ascending: false })
    .limit(2000);

  const context = buildHealthContextFromRows(rows ?? [], today);
  context.healthKitAvailable = connection?.is_connected === true || (rows?.length ?? 0) > 0;
  return context;
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
