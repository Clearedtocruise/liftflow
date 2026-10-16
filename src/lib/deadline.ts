/**
 * Waits for background work without letting it hold the screen hostage.
 *
 * Resolves when the work settles or the time is up, whichever comes first, and never rejects: the
 * caller wants to move on either way, and whatever is still running carries on unobserved.
 */
export async function settleWithin(work: Promise<unknown>, ms: number): Promise<'settled' | 'timed_out'> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<'timed_out'>((resolve) => {
    timer = setTimeout(() => resolve('timed_out'), ms);
  });
  try {
    return await Promise.race([work.then(() => 'settled' as const, () => 'settled' as const), timedOut]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** "12s" under a minute, "1m 05s" after, for the waiting hint on a slow request. */
export function formatElapsed(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  if (whole < 60) return `${whole}s`;
  return `${Math.floor(whole / 60)}m ${String(whole % 60).padStart(2, '0')}s`;
}
