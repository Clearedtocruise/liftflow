const appStartTime = Date.now();

export type StartupMilestone =
  | 'APP_START'
  | 'AUTH_READY'
  | 'PROFILE_READY'
  | 'PROFILE_LOADED'
  | 'HOME_RENDERED'
  | 'WORKOUT_PLAN_LOADED'
  | 'WORKOUTS_LOADED'
  | 'NUTRITION_PLAN_LOADED'
  | 'RECOVERY_LOADED'
  | 'AI_COACH_LOADED'
  | 'APP_READY'
  | 'SPLASH_HIDDEN'
  | 'PLAN_PREFETCH_START'
  | 'PLAN_PREFETCH_DONE';

const logged = new Set<StartupMilestone>();
const timeline: Array<{ milestone: StartupMilestone; elapsedMs: number; detail?: Record<string, unknown> }> =
  [];

let appStartLogged = false;

export function markAppStart(): void {
  if (appStartLogged) return;
  appStartLogged = true;
  logStartup('APP_START');
}

export function logStartup(milestone: StartupMilestone, detail?: Record<string, unknown>): void {
  const elapsedMs = Date.now() - appStartTime;
  if (!logged.has(milestone)) {
    logged.add(milestone);
    timeline.push({ milestone, elapsedMs, detail });
  }

  const suffix = detail ? ` ${JSON.stringify(detail)}` : '';
  const message = `[startup] ${milestone} +${elapsedMs}ms${suffix}`;
  if (__DEV__) {
    console.log(message);
  } else {
    console.info(message);
  }
}

export function getStartupTimeline(): typeof timeline {
  return [...timeline];
}

export function printStartupReport(): void {
  const lines = timeline.map((entry) => `${entry.milestone}: +${entry.elapsedMs}ms`);
  const report = `[startup] report\n${lines.join('\n')}`;
  if (__DEV__) {
    console.log(report);
  } else {
    console.info(report);
  }
}
