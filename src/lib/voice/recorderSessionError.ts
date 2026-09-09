/**
 * Native / expo-av errors that mean the shared audio session is still held by a previous
 * recording or TTS pass — not the backend rate-limit copy "Voice is busy".
 */
export function isRecorderSessionBusyError(error: unknown): boolean {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const lower = raw.toLowerCase();
  return (
    lower.includes('only one recording') ||
    lower.includes('recorder not prepared') ||
    lower.includes('prepare encountered an error') ||
    (lower.includes('audio session') && lower.includes('busy')) ||
    lower.includes('session is busy') ||
    lower.includes('error code 561017449') // AVAudioSessionErrorCodeIsBusy
  );
}
