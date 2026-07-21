/**
 * Client-side egress protection: request dedupe, throttling, and lightweight telemetry.
 * Prevents identical in-flight Supabase/API calls and surfaces abnormal request spikes.
 */

type EgressBucket = {
  count: number;
  bytesEstimate: number;
  lastAt: number;
};

const buckets = new Map<string, EgressBucket>();
const inFlight = new Map<string, Promise<unknown>>();
const lastRunAt = new Map<string, number>();

const SPIKE_WINDOW_MS = 60_000;
const SPIKE_THRESHOLD = 40;

export function egressKey(parts: Array<string | number | boolean | null | undefined>): string {
  return parts.map((p) => (p == null ? '' : String(p))).join('|');
}

/** Collapse concurrent identical async work into a single promise. */
export function dedupeInFlight<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = factory().finally(() => {
    if (inFlight.get(key) === promise) inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}

/**
 * Returns true when enough time has passed since the last successful run for `key`.
 * Call `markThrottle(key)` after a successful run.
 */
export function canRunThrottled(key: string, minIntervalMs: number): boolean {
  const last = lastRunAt.get(key) ?? 0;
  return Date.now() - last >= minIntervalMs;
}

export function markThrottle(key: string): void {
  lastRunAt.set(key, Date.now());
}

export function peekThrottleAgeMs(key: string): number | null {
  const last = lastRunAt.get(key);
  if (last == null) return null;
  return Date.now() - last;
}

export function recordEgress(
  endpoint: string,
  options?: { bytesEstimate?: number; meta?: Record<string, unknown> },
): void {
  const now = Date.now();
  const current = buckets.get(endpoint) ?? { count: 0, bytesEstimate: 0, lastAt: now };
  const resetWindow = now - current.lastAt > SPIKE_WINDOW_MS;
  const next: EgressBucket = resetWindow
    ? { count: 1, bytesEstimate: options?.bytesEstimate ?? 0, lastAt: now }
    : {
        count: current.count + 1,
        bytesEstimate: current.bytesEstimate + (options?.bytesEstimate ?? 0),
        lastAt: current.lastAt,
      };
  buckets.set(endpoint, next);

  if (next.count === SPIKE_THRESHOLD) {
    console.warn('[egress] request spike', {
      endpoint,
      countInWindow: next.count,
      bytesEstimate: next.bytesEstimate,
      ...options?.meta,
    });
  }

  if (__DEV__ && next.count <= 3) {
    console.log('[egress]', endpoint, {
      countInWindow: next.count,
      bytesEstimate: next.bytesEstimate,
      ...options?.meta,
    });
  }
}

export function getEgressSnapshot(): Record<string, EgressBucket> {
  return Object.fromEntries(buckets.entries());
}

export function resetEgressTelemetry(): void {
  buckets.clear();
}
