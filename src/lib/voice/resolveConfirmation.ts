import type { ConfirmationMode } from '@/types/common';
import type { VoiceSettings } from '@/types/voice';

const SMART_CONFIDENCE_THRESHOLD = 0.8;

export function resolveRequiresConfirmation(params: {
  confidence: number;
  confirmationMode: ConfirmationMode;
  autoLog: boolean;
  lowConfidenceFallback?: boolean;
}): { requiresConfirmation: boolean; confirmationReason?: string } {
  const { confidence, confirmationMode, autoLog, lowConfidenceFallback = true } = params;

  if (confirmationMode === 'none') {
    return { requiresConfirmation: false };
  }

  if (confirmationMode === 'always') {
    return { requiresConfirmation: true, confirmationReason: 'Voice confirmation is set to Always' };
  }

  // smart mode
  if (autoLog && confidence >= SMART_CONFIDENCE_THRESHOLD) {
    return { requiresConfirmation: false };
  }

  if (confidence >= SMART_CONFIDENCE_THRESHOLD) {
    return { requiresConfirmation: false };
  }

  if (lowConfidenceFallback) {
    return {
      requiresConfirmation: true,
      confirmationReason: 'Low confidence parse — please confirm',
    };
  }

  return { requiresConfirmation: false };
}

export function resolveFromVoiceSettings(
  confidence: number,
  settings: Pick<VoiceSettings, 'confirmationMode' | 'autoLog'>,
): { requiresConfirmation: boolean; confirmationReason?: string } {
  return resolveRequiresConfirmation({
    confidence,
    confirmationMode: settings.confirmationMode,
    autoLog: settings.autoLog,
  });
}
