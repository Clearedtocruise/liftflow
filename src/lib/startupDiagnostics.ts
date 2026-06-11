import { markCrashMarker } from '@/lib/crashDiagnostics';

const APP_START_MS = Date.now();

export type StartupDiagnosticEvent =
  | 'APP_START_INIT'
  | 'APP_START_AUTH_BEGIN'
  | 'APP_START_AUTH_COMPLETE'
  | 'APP_START_SERVICES_BEGIN'
  | 'APP_START_SERVICES_COMPLETE'
  | 'APP_START_DATA_LOAD_BEGIN'
  | 'APP_START_DATA_LOAD_COMPLETE'
  | 'APP_READY'
  | 'APP_LOAD_TIME_RECORDED'
  | 'APP_START_FAILURE';

type StartupPayload = Record<string, string | number | boolean | undefined | null>;

export function logStartupDiagnostic(event: StartupDiagnosticEvent, payload?: StartupPayload): void {
  const elapsedMs = Date.now() - APP_START_MS;
  const detail = payload ? ` ${JSON.stringify({ ...payload, elapsedMs })}` : ` {"elapsedMs":${elapsedMs}}`;
  console.log(`[StartupDiagnostic] ${event}${detail}`);
  markCrashMarker(event, { ...payload, elapsedMs });
}

export function recordAppReady(source: string): void {
  const loadTimeMs = Date.now() - APP_START_MS;
  markCrashMarker('APP_READY', { source, loadTimeMs });
  logStartupDiagnostic('APP_READY', { source });
  logStartupDiagnostic('APP_LOAD_TIME_RECORDED', { loadTimeMs, source });
}
