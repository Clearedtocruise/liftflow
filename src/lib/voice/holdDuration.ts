/**
 * Spoken hold durations — "sixty seconds", "a minute", "minute and a half".
 *
 * Voice logging only ever understood weight and reps, so a hold said out loud committed whatever
 * the duration stepper happened to show. A plank is one of the exercises most worth logging
 * hands-free, since the lifter is face down on the floor at the time.
 */

const SPOKEN_NUMBERS: Record<string, number> = {
  a: 1,
  an: 1,
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
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fortyfive: 45,
  'forty-five': 45,
  fifty: 50,
  sixty: 60,
  ninety: 90,
};

const SECONDS_UNIT = String.raw`s|sec|secs|second|seconds`;
const MINUTES_UNIT = String.raw`m|min|mins|minute|minutes`;
const NUMBER = String.raw`\d+|[a-z]+(?:-[a-z]+)?`;

function toNumber(token: string | undefined): number | undefined {
  if (!token) return undefined;
  const trimmed = token.trim().toLowerCase();
  if (/^\d+$/.test(trimmed)) {
    const value = Number.parseInt(trimmed, 10);
    return Number.isFinite(value) ? value : undefined;
  }
  return SPOKEN_NUMBERS[trimmed];
}

/**
 * Seconds heard in an utterance, or undefined when it does not describe a duration.
 *
 * Deliberately requires a time unit. A bare number is far more likely to be reps or load, and
 * guessing wrong writes a wrong set — the caller decides what a bare number means using the
 * exercise it is logging against.
 */
export function parseSpokenDurationSeconds(text: string | undefined | null): number | undefined {
  const raw = (text ?? '').trim().toLowerCase();
  if (!raw) return undefined;

  // "a minute and a half", "minute and a half"
  if (/\b(?:a\s+)?(?:min|mins|minute|minutes)\s+and\s+a\s+half\b/.test(raw)) return 90;
  if (/\bhalf\s+a\s+(?:min|minute)\b/.test(raw)) return 30;

  // "1:30"
  const clock = raw.match(/\b(\d+)\s*:\s*([0-5]\d)\b/);
  if (clock) {
    const seconds = Number.parseInt(clock[1]!, 10) * 60 + Number.parseInt(clock[2]!, 10);
    if (seconds > 0) return seconds;
  }

  // "2 minutes 30 seconds", "one minute thirty"
  const combined = raw.match(
    new RegExp(String.raw`\b(${NUMBER})\s*(?:${MINUTES_UNIT})\b\s*(?:and\s+)?(${NUMBER})\s*(?:${SECONDS_UNIT})?\b`),
  );
  if (combined) {
    const minutes = toNumber(combined[1]);
    const seconds = toNumber(combined[2]);
    if (minutes != null && minutes > 0 && seconds != null && seconds > 0 && seconds < 60) {
      return minutes * 60 + seconds;
    }
  }

  const minutes = raw.match(new RegExp(String.raw`\b(${NUMBER})\s*(?:${MINUTES_UNIT})\b`));
  if (minutes) {
    const value = toNumber(minutes[1]);
    if (value != null && value > 0) return value * 60;
  }

  const seconds = raw.match(new RegExp(String.raw`\b(${NUMBER})\s*(?:${SECONDS_UNIT})\b`));
  if (seconds) {
    const value = toNumber(seconds[1]);
    if (value != null && value > 0) return value;
  }

  return undefined;
}

/** Whether an utterance mentions a time unit at all, used to keep rep patterns off holds. */
export function mentionsDuration(text: string | undefined | null): boolean {
  return new RegExp(String.raw`\b\d+\s*(?:${SECONDS_UNIT}|${MINUTES_UNIT})\b|\bfor\s+(?:a|an|one)\s+(?:${MINUTES_UNIT})\b`, 'i').test(
    (text ?? '').trim(),
  );
}
