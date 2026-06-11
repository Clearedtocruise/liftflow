/** Wake phrases that arm voice set logging without pressing the mic. */
const WAKE_PREFIXES = [
  /^(hey\s+)?one\s+more[,.]?\s*/i,
  /^log\s+(?:the\s+)?set[,.]?\s*/i,
  /^ok\s+one\s+more[,.]?\s*/i,
] as const;

const WAKE_ONLY = [
  /^(?:hey\s+)?one\s+more[,.]?\s*$/i,
  /^log\s+(?:the\s+)?set[,.]?\s*$/i,
  /^ok\s+one\s+more[,.]?\s*$/i,
] as const;

export type WakePhraseParse = {
  hasWake: boolean;
  isWakeOnly: boolean;
  command: string;
};

export function parseWakePhrase(text: string): WakePhraseParse {
  const trimmed = text.trim();
  if (!trimmed) {
    return { hasWake: false, isWakeOnly: false, command: '' };
  }

  for (let i = 0; i < WAKE_PREFIXES.length; i++) {
    const prefix = WAKE_PREFIXES[i];
    const only = WAKE_ONLY[i];
    if (prefix.test(trimmed)) {
      const command = trimmed.replace(prefix, '').trim();
      return {
        hasWake: true,
        isWakeOnly: only.test(trimmed) || command.length === 0,
        command,
      };
    }
  }

  return { hasWake: false, isWakeOnly: false, command: trimmed };
}

export const WAKE_PHRASE_HINT = 'Say "One More" or "Log set", then your set';
