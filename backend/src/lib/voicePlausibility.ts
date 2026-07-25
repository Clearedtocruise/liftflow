/**
 * Server-side plausibility rules for parsed voice sets.
 *
 * A speech-to-text mishearing writes directly into workout history, which then feeds the
 * progression and 1RM engines — so an implausible set must never be committed without the
 * user seeing it. These thresholds and confidence constants are mirrored in
 * `src/lib/voice/voicePlausibility.ts`; change both together or the client and the backend
 * will disagree about the same utterance.
 */

/** Routing gate: at or above this, the client trusts its local parse and skips the network. */
export const FAST_PATH_CONFIDENCE = 0.88;
/** Confirmation gate: below this, the user is always asked to confirm. */
export const CONFIRM_CONFIDENCE = 0.8;

/** Ceiling applied to any LLM-produced parse: the model self-reports confidence, so it can
 * never be allowed to vote itself past the confirmation gate. */
export const LLM_MAX_CONFIDENCE = 0.75;
/** Assigned when weight/reps order could not be determined from the wording. */
export const AMBIGUOUS_CONFIDENCE = 0.6;
/** Assigned when a value fails a range check — well under every gate. */
export const IMPLAUSIBLE_CONFIDENCE = 0.2;
/** Assigned when more sets were spoken than were parsed. */
export const TRUNCATED_CONFIDENCE = 0.55;

export const REPS_MIN = 1;
export const REPS_MAX = 100;
export const WEIGHT_MAX_LB = 1500;
export const WEIGHT_MAX_KG = 700;

/** A voice command is a short phrase; anything longer is not speech we should pay to parse. */
export const MAX_TRANSCRIPT_CHARS = 500;
export const MAX_EXERCISE_NAME_CHARS = 80;

export type PlausibilityFlags = {
  /** A value failed a hard range check. Must force confirmation regardless of preferences. */
  implausible?: boolean;
  /** Weight/reps order was guessed from magnitude rather than read from the wording. */
  ambiguousOrder?: boolean;
  /** More sets were spoken than were parsed. */
  multipleSetsHeard?: boolean;
  validationReason?: string;
};

function maxWeightFor(unit?: 'lb' | 'kg'): number {
  return unit === 'kg' ? WEIGHT_MAX_KG : WEIGHT_MAX_LB;
}

/**
 * Wording like "bench press 225 8" carries no unit or keyword to say which number is which.
 * Spoken sets are overwhelmingly heavier-than-they-are-long, so the larger value is treated as
 * the weight — but the guess is always surfaced for confirmation rather than committed.
 */
export function orderWeightAndReps(first: number, second: number): { weight: number; reps: number } {
  return { weight: Math.max(first, second), reps: Math.min(first, second) };
}

export type SetValueCheck = PlausibilityFlags & { confidenceCeiling?: number };

/** Range-checks a parsed set. Returns the flags to merge into the command. */
export function checkSetValues(values: {
  weight?: number;
  reps?: number;
  weightUnit?: 'lb' | 'kg';
}): SetValueCheck {
  const { weight, reps, weightUnit } = values;

  if (reps != null) {
    if (!Number.isFinite(reps) || !Number.isInteger(reps) || reps < REPS_MIN || reps > REPS_MAX) {
      return {
        implausible: true,
        confidenceCeiling: IMPLAUSIBLE_CONFIDENCE,
        validationReason: `Heard ${reps} reps — outside the ${REPS_MIN}-${REPS_MAX} range. Please confirm or re-enter.`,
      };
    }
  }

  if (weight != null) {
    const max = maxWeightFor(weightUnit);
    if (!Number.isFinite(weight) || weight < 0 || weight > max) {
      return {
        implausible: true,
        confidenceCeiling: IMPLAUSIBLE_CONFIDENCE,
        validationReason: `Heard ${weight} ${weightUnit ?? 'lb'} — outside the 0-${max} range. Please confirm or re-enter.`,
      };
    }
  }

  return {};
}

/** Trailing politeness and punctuation is normal in real speech and must not defeat a `$` anchor. */
export function stripTrailingFiller(text: string): string {
  return text
    .replace(
      /(?:[\s.,!?;]+|\b(?:please|thanks|thank\s+you|now|okay|ok|alright|bro|dude|man)\b)+$/gi,
      '',
    )
    .trim();
}

const NON_EXERCISE_LEAD =
  /^(?:failed|missed|got|did|hit|felt|feels?|same|undo|delete|next|completed|finished|starting|switching|reduce|decrease|lower|drop|increase|bump|add|go\s+up)\b/i;

/**
 * The lazy `.+?` exercise group happily absorbs the preposition that introduced the numbers
 * ("bench press for"), and the resulting name never matches the exercise catalog.
 */
export function cleanExerciseName(name?: string): string | undefined {
  let cleaned = (name ?? '').trim();
  let previous: string;
  do {
    previous = cleaned;
    cleaned = cleaned
      .replace(/[\s,.;:@]+$/g, '')
      .replace(/\s+(?:for|at|of|with|to|and|the|a|an|x)$/i, '')
      .trim();
  } while (cleaned !== previous);

  if (!cleaned) return undefined;
  return cleaned.slice(0, MAX_EXERCISE_NAME_CHARS);
}

/** Feedback and control phrases are not exercise names, whichever parser produced them. */
export function looksLikeNonExercise(name?: string): boolean {
  if (!name) return false;
  return NON_EXERCISE_LEAD.test(name.trim());
}

const CLAUSE_SEPARATOR = /\b(?:then|and\s+then|after\s+that|followed\s+by|also|next\s+up|plus)\b/i;
const SECOND_SET_SHAPE = /\d+(?:\.\d+)?\s*(?:lbs?|pounds?|kg|kilos?)?\s*(?:for|x|\*|×|reps?)\s*\d+/i;

/** True when the text after the parsed clause still describes another set. */
export function hasAdditionalSets(remainder: string): boolean {
  if (!remainder.trim()) return false;
  return CLAUSE_SEPARATOR.test(remainder) || SECOND_SET_SHAPE.test(remainder);
}
