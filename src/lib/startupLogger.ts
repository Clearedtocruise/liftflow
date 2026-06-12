const appStartTime = Date.now();

export type StartupMilestone =
  | 'APP_START'
  | 'AUTH_READY'
  | 'HOME_RENDERED'
  | 'PROFILE_LOADED'
  | 'WORKOUTS_LOADED'
  | 'APP_READY';

let appStartLogged = false;

export function markAppStart(): void {
  if (appStartLogged) return;
  appStartLogged = true;
  logStartup('APP_START');
}

export function logStartup(milestone: StartupMilestone, detail?: Record<string, unknown>): void {
  const elapsedMs = Date.now() - appStartTime;
  const suffix = detail ? ` ${JSON.stringify(detail)}` : '';
  const message = `[startup] ${milestone} +${elapsedMs}ms${suffix}`;
  if (__DEV__) {
    console.log(message);
  } else {
    console.info(message);
  }
}
