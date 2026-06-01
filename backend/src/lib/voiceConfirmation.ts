export function resolveRequiresConfirmation(params: {
  confidence: number;
  confirmationMode: 'always' | 'smart' | 'none';
  autoLog?: boolean;
}): { requiresConfirmation: boolean; confirmationReason?: string } {
  const { confidence, confirmationMode, autoLog = true } = params;

  if (confirmationMode === 'none') return { requiresConfirmation: false };
  if (confirmationMode === 'always') {
    return { requiresConfirmation: true, confirmationReason: 'Voice confirmation is set to Always' };
  }
  if (autoLog && confidence >= 0.8) return { requiresConfirmation: false };
  if (confidence >= 0.8) return { requiresConfirmation: false };
  return { requiresConfirmation: true, confirmationReason: 'Please confirm parsed values' };
}
