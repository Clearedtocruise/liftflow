import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { captureMobileException, Sentry } from '@/lib/sentry';

const STORAGE_KEY = '@liftflow/crash_trail_v1';
const MAX_TRAIL = 80;
const APP_START_MS = Date.now();

export type CrashMarker =
  | 'APP_START'
  | 'AUTH_INIT'
  | 'SUPABASE_INIT'
  | 'REVENUECAT_INIT'
  | 'NAVIGATION_READY'
  | 'WORKOUT_SCREEN_MOUNT'
  | 'NUTRITION_SCREEN_MOUNT'
  | 'VOICE_INIT'
  | 'APP_READY';

export type CrashDiagnosticEntry = {
  ts: string;
  elapsedMs: number;
  marker: string;
  detail?: Record<string, string | number | boolean | null | undefined>;
};

export type CrashFatalRecord = {
  ts: string;
  elapsedMs: number;
  name: string;
  message: string;
  stack?: string;
  fatal?: boolean;
  source?: string;
  lastMarker?: string;
};

type CrashTrail = {
  buildNumber?: string;
  version?: string;
  platform: string;
  entries: CrashDiagnosticEntry[];
  lastFatal?: CrashFatalRecord;
};

let trail: CrashTrail = {
  platform: Platform.OS,
  entries: [],
};

let persistChain: Promise<void> = Promise.resolve();
let installed = false;

function buildMeta(): Pick<CrashTrail, 'buildNumber' | 'version' | 'platform'> {
  return {
    platform: Platform.OS,
    version: Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? 'unknown',
    buildNumber: Constants.nativeBuildVersion ?? undefined,
  };
}

function appendEntry(marker: string, detail?: CrashDiagnosticEntry['detail']): CrashDiagnosticEntry {
  const entry: CrashDiagnosticEntry = {
    ts: new Date().toISOString(),
    elapsedMs: Date.now() - APP_START_MS,
    marker,
    detail,
  };
  trail = {
    ...trail,
    ...buildMeta(),
    entries: [...trail.entries, entry].slice(-MAX_TRAIL),
  };
  const payload = detail ? JSON.stringify({ ...detail, elapsedMs: entry.elapsedMs }) : `{elapsedMs:${entry.elapsedMs}}`;
  console.log(`[CrashDiag] ${marker} ${payload}`);
  Sentry.addBreadcrumb({
    category: 'crash.marker',
    message: marker,
    level: 'info',
    data: { ...detail, elapsedMs: entry.elapsedMs },
  });
  return entry;
}

export function markCrashMarker(marker: CrashMarker | string, detail?: CrashDiagnosticEntry['detail']): void {
  appendEntry(marker, detail);
  void persistCrashTrail();
}

export function getCrashDiagnosticTrail(): CrashDiagnosticEntry[] {
  return [...trail.entries];
}

export function getLastCrashMarker(): string | undefined {
  return trail.entries[trail.entries.length - 1]?.marker;
}

export function getLastFatalRecord(): CrashFatalRecord | undefined {
  return trail.lastFatal;
}

export async function loadPersistedCrashTrail(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as CrashTrail;
    if (parsed?.entries?.length) {
      trail = {
        ...trail,
        ...parsed,
        entries: parsed.entries.slice(-MAX_TRAIL),
      };
      console.log(`[CrashDiag] restored ${parsed.entries.length} persisted markers`);
    }
  } catch {
    // ignore restore errors
  }
}

export function persistCrashTrail(): Promise<void> {
  persistChain = persistChain.then(async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trail));
    } catch {
      // ignore persistence errors
    }
  });
  return persistChain;
}

export function recordCrashError(
  error: unknown,
  context?: { source?: string; fatal?: boolean; marker?: string },
): CrashFatalRecord {
  const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Unknown error');
  const record: CrashFatalRecord = {
    ts: new Date().toISOString(),
    elapsedMs: Date.now() - APP_START_MS,
    name: err.name,
    message: err.message,
    stack: err.stack,
    fatal: context?.fatal,
    source: context?.source,
    lastMarker: context?.marker ?? getLastCrashMarker(),
  };
  trail = { ...trail, ...buildMeta(), lastFatal: record };
  appendEntry('CRASH_RECORDED', {
    source: context?.source,
    fatal: context?.fatal,
    error: err.message,
    lastMarker: record.lastMarker,
  });
  void persistCrashTrail();
  captureMobileException(err, { screen: context?.source ?? 'global' });
  void flushCrashReportToServer(record);
  return record;
}

export async function flushCrashReportToServer(fatal?: CrashFatalRecord): Promise<void> {
  if (Platform.OS === 'web') return;
  const apiBase = process.env.EXPO_PUBLIC_API_URL ?? 'https://liftflow-api.onrender.com';
  try {
    await fetch(`${apiBase}/api/debug/client-crash`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trail: trail.entries,
        fatal: fatal ?? trail.lastFatal,
        meta: buildMeta(),
      }),
    });
  } catch {
    // best effort
  }
}

export function installCrashDiagnostics(): void {
  if (installed) return;
  installed = true;
  trail = { ...trail, ...buildMeta() };
  void loadPersistedCrashTrail().then(() => {
    if (trail.lastFatal) {
      markCrashMarker('PREVIOUS_CRASH_DETECTED', {
        message: trail.lastFatal.message,
        source: trail.lastFatal.source,
        lastMarker: trail.lastFatal.lastMarker,
      });
      void flushCrashReportToServer(trail.lastFatal);
    }
    markCrashMarker('APP_START', { phase: 'installCrashDiagnostics' });
  });
}
