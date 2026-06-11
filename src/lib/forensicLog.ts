import { Platform } from 'react-native';

import { captureMobileException } from '@/lib/sentry';

export type ForensicMarker =
  | 'APP_START'
  | 'APP_BOOT_COMPLETE'
  | 'APP_CRASH'
  | 'SUPABASE_INIT_START'
  | 'SUPABASE_INIT_SUCCESS'
  | 'SUPABASE_INIT_FAIL'
  | 'REVENUECAT_INIT_START'
  | 'REVENUECAT_INIT_SUCCESS'
  | 'REVENUECAT_INIT_FAIL'
  | 'WORKOUT_LOAD_START'
  | 'WORKOUT_LOAD_SUCCESS'
  | 'WORKOUT_LOAD_FAIL'
  | 'NUTRITION_LOAD_START'
  | 'NUTRITION_LOAD_SUCCESS'
  | 'NUTRITION_LOAD_FAIL'
  | 'VOICE_INIT_START'
  | 'VOICE_INIT_SUCCESS'
  | 'VOICE_INIT_FAIL';

const buffer: Array<{ at: string; marker: ForensicMarker; detail?: Record<string, unknown> }> = [];

function stamp(): string {
  return new Date().toISOString();
}

export function forensicLog(marker: ForensicMarker, detail?: Record<string, unknown>): void {
  const entry = { at: stamp(), marker, detail };
  buffer.push(entry);
  if (buffer.length > 200) buffer.shift();
  const suffix = detail ? ` ${JSON.stringify(detail)}` : '';
  console.log(`[FORENSIC] ${marker}${suffix}`);
}

export function forensicLogError(marker: ForensicMarker, error: unknown, detail?: Record<string, unknown>): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  forensicLog(marker, { ...detail, message, stack });
  captureMobileException(error instanceof Error ? error : new Error(message), {
    screen: marker,
  });
}

export function forensicCrash(error: unknown, source: string): void {
  forensicLogError('APP_CRASH', error, { source, platform: Platform.OS });
}

export function getForensicBuffer(): typeof buffer {
  return [...buffer];
}

let handlersInstalled = false;

export function installForensicCrashHandlers(): void {
  if (handlersInstalled || Platform.OS === 'web') return;
  handlersInstalled = true;

  const prevHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    forensicCrash(error, isFatal ? 'global_fatal' : 'global_error');
    prevHandler?.(error, isFatal);
  });
}
