import { markCrashMarker, recordCrashError } from '@/lib/crashDiagnostics';
import { captureMobileException } from '@/lib/sentry';

export type VoiceDiagnosticEvent =
  | 'MIC_BUTTON_PRESSED'
  | 'VOICE_PERMISSION_CHECK_STARTED'
  | 'VOICE_PERMISSION_CHECK_SUCCESS'
  | 'VOICE_PERMISSION_CHECK_FAILED'
  | 'VOICE_SERVICE_INIT_STARTED'
  | 'VOICE_SERVICE_INIT_SUCCESS'
  | 'VOICE_SERVICE_INIT_FAILED'
  | 'VOICE_LISTEN_START_STARTED'
  | 'VOICE_LISTEN_START_SUCCESS'
  | 'VOICE_LISTEN_START_FAILED'
  | 'VOICE_CRASH_CAUGHT';

type VoiceDiagnosticPayload = Record<string, string | number | boolean | undefined | null>;

export function logVoiceDiagnostic(event: VoiceDiagnosticEvent, payload?: VoiceDiagnosticPayload): void {
  const detail = payload ? ` ${JSON.stringify(payload)}` : '';
  console.log(`[VoiceDiagnostic] ${event}${detail}`);
  markCrashMarker(`VOICE_${event}`, payload);
  if (event.includes('FAILED') || event === 'VOICE_CRASH_CAUGHT') {
    recordCrashError(new Error(`${event}${detail}`), { source: 'voice_service', fatal: false });
    captureMobileException(new Error(event), { screen: 'voice' });
  }
}
