import { CONFIRM_CONFIDENCE } from './voicePlausibility.js';

/**
 * Mirrors `src/lib/voice/resolveConfirmation.ts`. `blockAutoCommit` outranks every preference:
 * a value that failed a range check is corrupt data, and no setting should let it into the log
 * without the user seeing it.
 */
export function resolveRequiresConfirmation(params: {
  confidence: number;
  confirmationMode: 'always' | 'smart' | 'none';
  autoLog?: boolean;
  blockAutoCommit?: boolean;
  blockReason?: string;
}): { requiresConfirmation: boolean; confirmationReason?: string } {
  const { confidence, confirmationMode, autoLog = true, blockAutoCommit = false, blockReason } = params;

  if (blockAutoCommit) {
    return {
      requiresConfirmation: true,
      confirmationReason: blockReason ?? 'Values look implausible — please confirm',
    };
  }
  if (confirmationMode === 'none') return { requiresConfirmation: false };
  if (confirmationMode === 'always') {
    return { requiresConfirmation: true, confirmationReason: 'Voice confirmation is set to Always' };
  }
  if (!autoLog) {
    return { requiresConfirmation: true, confirmationReason: 'Auto-log is off — please confirm' };
  }
  if (confidence >= CONFIRM_CONFIDENCE) return { requiresConfirmation: false };
  return { requiresConfirmation: true, confirmationReason: 'Please confirm parsed values' };
}
