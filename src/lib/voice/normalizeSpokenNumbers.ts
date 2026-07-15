const ONES: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const TENS_PATTERN = 'twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety';
const ONES_PATTERN = 'one|two|three|four|five|six|seven|eight|nine';

/** Convert spoken numbers ("forty five", "forty-five") before single-digit word replacement. */
export function normalizeSpokenNumbers(text: string): string {
  let normalized = text.toLowerCase();

  // "one hundred thirty five" / "two hundred five"
  normalized = normalized.replace(
    new RegExp(
      `\\b(${ONES_PATTERN})\\s+hundred(?:\\s+and)?(?:\\s+(${TENS_PATTERN}))?(?:\\s+(${ONES_PATTERN}))?\\b`,
      'g',
    ),
    (_m, hundredsWord: string, tensWord?: string, onesWord?: string) => {
      const hundreds = (ONES[hundredsWord] ?? 0) * 100;
      const tens = tensWord ? (TENS[tensWord] ?? 0) : 0;
      const ones = onesWord ? (ONES[onesWord] ?? 0) : 0;
      return String(hundreds + tens + ones);
    },
  );

  // Gym shorthand: "one thirty five" → 135, "two twenty five" → 225
  normalized = normalized.replace(
    new RegExp(`\\b(${ONES_PATTERN})\\s+(${TENS_PATTERN})\\s+(${ONES_PATTERN})\\b`, 'g'),
    (_m, hundredsWord: string, tensWord: string, onesWord: string) =>
      String((ONES[hundredsWord] ?? 0) * 100 + (TENS[tensWord] ?? 0) + (ONES[onesWord] ?? 0)),
  );

  normalized = normalized.replace(
    new RegExp(`\\b(${TENS_PATTERN})[-\\s]+(${ONES_PATTERN})\\b`, 'g'),
    (_, tensWord: string, onesWord: string) => String(TENS[tensWord]! + ONES[onesWord]!),
  );

  for (const [word, value] of Object.entries(TENS)) {
    normalized = normalized.replace(new RegExp(`\\b${word}\\b`, 'g'), String(value));
  }

  for (const [word, value] of Object.entries(ONES)) {
    normalized = normalized.replace(new RegExp(`\\b${word}\\b`, 'g'), String(value));
  }

  return normalized
    .replace(/pounds/g, 'lb')
    .replace(/lbs/g, 'lb')
    .replace(/kilograms/g, 'kg')
    .replace(/kilos/g, 'kg')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Strip trailing punctuation speech engines often append. */
export function stripTrailingSpeechPunctuation(text: string): string {
  return text.replace(/[.,!?;:]+$/g, '').trim();
}

/** Remove wake phrase and common logging prefixes so anchored parsers still match. */
export function stripVoiceCommandPrefixes(text: string): string {
  return text
    .replace(/^(?:hey\s+one\s*more|ok\s+one\s*more|one\s*more|hey\s+lift\s*flow)[,.]?\s*/i, '')
    .replace(/^(?:please\s+)?(?:log|add|record)\s+/i, '')
    .trim();
}

export function normalizeVoiceTranscript(text: string): string {
  return stripTrailingSpeechPunctuation(
    stripVoiceCommandPrefixes(normalizeSpokenNumbers(text)),
  );
}
