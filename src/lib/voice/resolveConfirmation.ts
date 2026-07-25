import type { ConfirmationMode } from '@/types/common';
import type { ParsedVoiceCommandExtended, VoiceSettings } from '@/types/voice';

import { CONFIRM_CONFIDENCE } from './voicePlausibility';

/**
 * Mirrors `backend/src/lib/voiceConfirmation.ts`. `blockAutoCommit` outranks every preference:
 * a value that failed a range check is corrupt data, and no setting should let it into the log
 * without the user seeing it.
 */
export function resolveRequiresConfirmation(params: {
  confidence: number;
  confirmationMode: ConfirmationMode;
  autoLog: boolean;
  blockAutoCommit?: boolean;
  blockReason?: string;
}): { requiresConfirmation: boolean; confirmationReason?: string } {
  const { confidence, confirmationMode, autoLog, blockAutoCommit = false, blockReason } = params;

  if (blockAutoCommit) {
    return {
      requiresConfirmation: true,
      confirmationReason: blockReason ?? 'Values look implausible — please confirm',
    };
  }

  if (confirmationMode === 'none') {
    return { requiresConfirmation: false };
  }

  if (confirmationMode === 'always') {
    return { requiresConfirmation: true, confirmationReason: 'Voice confirmation is set to Always' };
  }

  // smart mode
  if (!autoLog) {
    return { requiresConfirmation: true, confirmationReason: 'Auto-log is off — please confirm' };
  }

  if (confidence >= CONFIRM_CONFIDENCE) {
    return { requiresConfirmation: false };
  }

  return {
    requiresConfirmation: true,
    confirmationReason: 'Low confidence parse — please confirm',
  };
}

export function resolveFromVoiceSettings(
  confidence: number,
  settings: Pick<VoiceSettings, 'confirmationMode' | 'autoLog'>,
  parsed?: Pick<ParsedVoiceCommandExtended, 'implausible' | 'validationReason'>,
): { requiresConfirmation: boolean; confirmationReason?: string } {
  return resolveRequiresConfirmation({
    confidence,
    confirmationMode: settings.confirmationMode,
    autoLog: settings.autoLog,
    blockAutoCommit: parsed?.implausible === true,
    blockReason: parsed?.validationReason,
  });
}
