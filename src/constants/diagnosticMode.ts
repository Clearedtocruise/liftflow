/** Emergency diagnostic flags — set via EAS env (EXPO_PUBLIC_*). */

export type DiagnosticStage =
  | 'boot'
  | 'supabase'
  | 'revenuecat'
  | 'workout'
  | 'nutrition'
  | 'voice'
  | 'notifications'
  | 'ai'
  | 'full';

const STAGE_ORDER: DiagnosticStage[] = [
  'boot',
  'supabase',
  'revenuecat',
  'workout',
  'nutrition',
  'voice',
  'notifications',
  'ai',
  'full',
];

function parseStage(raw: string | undefined): DiagnosticStage {
  const value = (raw ?? 'boot').trim().toLowerCase();
  if (STAGE_ORDER.includes(value as DiagnosticStage)) return value as DiagnosticStage;
  return 'boot';
}

export const DIAGNOSTIC_BOOT_TEST =
  process.env.EXPO_PUBLIC_BOOT_TEST === 'true' || process.env.EXPO_PUBLIC_BOOT_TEST === '1';

export const DIAGNOSTIC_STAGE = parseStage(process.env.EXPO_PUBLIC_DIAGNOSTIC_STAGE);

function stageIndex(stage: DiagnosticStage): number {
  return STAGE_ORDER.indexOf(stage);
}

/** True when the current build has reached at least this subsystem stage. */
export function diagnosticAtLeast(stage: DiagnosticStage): boolean {
  if (!DIAGNOSTIC_BOOT_TEST && stage !== 'full') return true;
  if (DIAGNOSTIC_STAGE === 'full') return true;
  return stageIndex(DIAGNOSTIC_STAGE) >= stageIndex(stage);
}
