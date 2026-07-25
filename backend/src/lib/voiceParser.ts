import { asPromptData, chatCompletionJson } from './openai.js';
import { resolveRequiresConfirmation } from './voiceConfirmation.js';
import {
    AMBIGUOUS_CONFIDENCE,
    checkSetValues,
    cleanExerciseName,
    hasAdditionalSets,
    IMPLAUSIBLE_CONFIDENCE,
    LLM_MAX_CONFIDENCE,
    looksLikeNonExercise,
    MAX_EXERCISE_NAME_CHARS,
    MAX_TRANSCRIPT_CHARS,
    orderWeightAndReps,
    REPS_MAX,
    stripTrailingFiller,
    TRUNCATED_CONFIDENCE,
    WEIGHT_MAX_KG,
    WEIGHT_MAX_LB,
} from './voicePlausibility.js';

export const VOICE_INTENTS = [
  'log_set',
  'completed_set',
  'adjust_weight',
  'feedback',
  'undo_last_set',
  'delete_last_set',
  'next_set',
  'declare_exercise',
  'recovery_query',
  'train_today_query',
  'build_workout',
  'nutrition_query',
  'grocery_list_query',
  'coach_query',
  'play_peak',
  'start_at_chorus',
  'sync_next_set',
  'sync_music_next_set',
  'use_pr_song',
  'resume_playlist',
  'next_hype_song',
  'transformation_query',
  'transformation_progress',
  'transformation_target_bf',
] as const;

export type VoiceIntent = (typeof VOICE_INTENTS)[number];

export type ParsedCommand = {
  exercise?: string;
  weight?: number;
  reps?: number;
  type?: string;
  confidence?: number;
  rawText: string;
  intent?: VoiceIntent;
  targetBodyFatPct?: number;
  feedback?: 'easy' | 'hard' | 'failed';
  weightAdjustment?: 'increase' | 'decrease';
  targetWeight?: number;
  weightUnit?: 'lb' | 'kg';
  usesContextWeight?: boolean;
  usesContextExercise?: boolean;
  /** A value failed a range check — must never auto-commit. */
  implausible?: boolean;
  /** Weight/reps order was inferred from magnitude, not from the wording. */
  ambiguousOrder?: boolean;
  /** The utterance described more sets than were parsed. */
  multipleSetsHeard?: boolean;
  validationReason?: string;
};

export type VoiceParseContext = {
  activeExerciseName?: string;
  lastWeight?: number;
  lastReps?: number;
  preferredWeightUnit?: 'lb' | 'kg';
  confirmationMode?: 'always' | 'smart' | 'none';
  autoLog?: boolean;
};

/**
 * `context` arrives from the request body, so nothing about it is trustworthy — it is rebuilt
 * field by field, with `activeExerciseName` length-capped and stripped of newlines before it can
 * reach a prompt.
 */
export function sanitizeParseContext(input: unknown): VoiceParseContext {
  if (typeof input !== 'object' || input === null) return {};
  const raw = input as Record<string, unknown>;

  const name = typeof raw.activeExerciseName === 'string'
    ? raw.activeExerciseName.replace(/[\r\n\t]+/g, ' ').trim().slice(0, MAX_EXERCISE_NAME_CHARS)
    : undefined;

  const boundedWeight = (value: unknown): number | undefined => {
    const parsed = coerceNumber(value);
    if (parsed == null || parsed < 0 || parsed > WEIGHT_MAX_LB) return undefined;
    return parsed;
  };

  const lastReps = coerceNumber(raw.lastReps);

  return {
    activeExerciseName: name || undefined,
    lastWeight: boundedWeight(raw.lastWeight),
    lastReps: lastReps != null && lastReps >= 0 && lastReps <= REPS_MAX ? Math.round(lastReps) : undefined,
    preferredWeightUnit: coerceEnum(raw.preferredWeightUnit, ['lb', 'kg'] as const),
    confirmationMode: coerceEnum(raw.confirmationMode, ['always', 'smart', 'none'] as const),
    autoLog: typeof raw.autoLog === 'boolean' ? raw.autoLog : undefined,
  };
}

/** A spoken command is a short phrase; a 2 MB body is abuse, not speech. */
export function readTranscript(input: unknown): { transcript: string } | { error: string } {
  if (typeof input !== 'string' || !input.trim()) return { error: 'transcript is required' };
  const transcript = input.trim();
  if (transcript.length > MAX_TRANSCRIPT_CHARS) {
    return { error: `transcript must be ${MAX_TRANSCRIPT_CHARS} characters or fewer` };
  }
  return { transcript };
}

function detectWeightUnit(text: string): 'lb' | 'kg' | undefined {
  if (/\bkg\b|kilos?\b/i.test(text)) return 'kg';
  if (/\blbs?\b|pounds?\b/i.test(text)) return 'lb';
  return undefined;
}

/**
 * Pattern table and per-pattern confidences are kept identical to the client's
 * `src/lib/voice/parseVoiceCommand.ts`. When the two drift, the same utterance gets different
 * confirmation behaviour depending on which side happened to parse it.
 */
const COACHING_PATTERNS: Array<{ pattern: RegExp; build: (match: RegExpMatchArray, text: string, ctx: VoiceParseContext) => ParsedCommand }> = [
  {
    pattern: /^(?:how\s+recovered\s+am\s+i|how(?:'s|\s+is)\s+my\s+recovery|what(?:'s|\s+is)\s+my\s+recovery\s+score)\??$/i,
    build: (_, text) => ({ intent: 'recovery_query', rawText: text, confidence: 0.95 }),
  },
  {
    pattern: /^(?:what\s+should\s+i\s+train\s+today|what\s+muscles?\s+should\s+i\s+train|what\s+should\s+i\s+work\s+out\s+today)\??$/i,
    build: (_, text) => ({ intent: 'train_today_query', rawText: text, confidence: 0.94 }),
  },
  {
    pattern: /^(?:build\s+(?:me\s+)?(?:a\s+)?workout|create\s+(?:me\s+)?(?:a\s+)?workout|generate\s+(?:me\s+)?(?:a\s+)?workout)\.?$/i,
    build: (_, text) => ({ intent: 'build_workout', rawText: text, confidence: 0.93 }),
  },
  {
    pattern: /^(?:what\s+should\s+i\s+eat\s+today|what\s+do\s+i\s+eat\s+today|what\s+should\s+i\s+eat)\??$/i,
    build: (_, text) => ({ intent: 'nutrition_query', rawText: text, confidence: 0.94 }),
  },
  {
    pattern: /^(?:build\s+(?:my\s+)?shopping\s+list|create\s+(?:my\s+)?(?:grocery|shopping)\s+list|generate\s+(?:my\s+)?grocery\s+list)\.?$/i,
    build: (_, text) => ({ intent: 'grocery_list_query', rawText: text, confidence: 0.93 }),
  },
  {
    pattern: /^(?:play\s+(?:the\s+)?good\s+part|hit\s+(?:the\s+)?good\s+part)\.?$/i,
    build: (_, text) => ({ intent: 'play_peak', rawText: text, confidence: 0.92 }),
  },
  {
    pattern: /^(?:start\s+at\s+(?:the\s+)?chorus|play\s+(?:the\s+)?chorus)\.?$/i,
    build: (_, text) => ({ intent: 'start_at_chorus', rawText: text, confidence: 0.91 }),
  },
  {
    pattern: /^(?:sync\s+with\s+next\s+set|sync\s+(?:to\s+)?next\s+set|sync\s+music\s+to\s+next\s+set|peak\s+sync)\.?$/i,
    build: (_, text) => ({ intent: 'sync_music_next_set', rawText: text, confidence: 0.9 }),
  },
  {
    pattern: /^(?:use\s+(?:a\s+)?pr\s+song|play\s+pr\s+song)\.?$/i,
    build: (_, text) => ({ intent: 'use_pr_song', rawText: text, confidence: 0.91 }),
  },
  {
    pattern: /^(?:resume\s+(?:my\s+)?playlist|go\s+back\s+to\s+(?:my\s+)?playlist)\.?$/i,
    build: (_, text) => ({ intent: 'resume_playlist', rawText: text, confidence: 0.9 }),
  },
  {
    pattern: /^(?:next\s+hype\s+song|next\s+hype\s+track|play\s+next\s+hype)\.?$/i,
    build: (_, text) => ({ intent: 'next_hype_song', rawText: text, confidence: 0.89 }),
  },
  {
    pattern: /^(?:show\s+(?:my\s+)?projection|show\s+(?:my\s+)?transformation|my\s+transformation)\??$/i,
    build: (_, text) => ({ intent: 'transformation_query', rawText: text, confidence: 0.93 }),
  },
  {
    pattern: /^(?:show\s+(?:my\s+)?progress|my\s+progress\s+photos?)\??$/i,
    build: (_, text) => ({ intent: 'transformation_progress', rawText: text, confidence: 0.92 }),
  },
  {
    pattern:
      /^(?:what\s+will\s+i\s+look\s+like\s+at\s+(?<bf>\d{1,2})(?:\s*(?:%|percent))?\s*(?:body\s*fat|bf)?|project(?:ion)?\s+(?:to|at)\s+(?<bf2>\d{1,2})\s*(?:%|percent)?)\??$/i,
    build: (m, text) => ({
      intent: 'transformation_target_bf',
      rawText: text,
      confidence: 0.92,
      targetBodyFatPct: Number(m.groups!.bf ?? m.groups!.bf2),
    }),
  },
  {
    pattern:
      /^(?:why\s+am\s+i\s+(?:stalled|fatigued|tired)|how\s+much\s+(?:should\s+i\s+)?lift|how\s+much\s+protein|coach\s+help|ask\s+(?:the\s+)?coach)\??$/i,
    build: (_, text) => ({ intent: 'coach_query', rawText: text, confidence: 0.91 }),
  },
  {
    pattern: /^(?:undo|delete)\s+(?:the\s+)?last\s+set\.?$/i,
    build: (_, text) => ({ intent: 'undo_last_set', rawText: text, confidence: 0.96 }),
  },
  {
    pattern: /^undo\.?$/i,
    build: (_, text) => ({ intent: 'undo_last_set', rawText: text, confidence: 0.94 }),
  },
  {
    pattern: /^(?:next\s+set|next)\.?$/i,
    build: (_, text) => ({ intent: 'next_set', rawText: text, confidence: 0.93 }),
  },
  {
    pattern: /^(?:completed|finished)\s+(?:the\s+)?set\.?$/i,
    build: (_, text) => ({ intent: 'completed_set', rawText: text, confidence: 0.92 }),
  },
  {
    pattern: /^(?:i'm|im|i am)\s+(?:doing|starting|on)\s+(?<exercise>.+?)\.?$/i,
    build: (m, text) => ({
      intent: 'declare_exercise',
      exercise: cleanExerciseName(m.groups!.exercise),
      rawText: text,
      confidence: 0.9,
    }),
  },
  {
    pattern: /^(?:starting|switching to)\s+(?<exercise>.+?)\.?$/i,
    build: (m, text) => ({
      intent: 'declare_exercise',
      exercise: cleanExerciseName(m.groups!.exercise),
      rawText: text,
      confidence: 0.88,
    }),
  },
  {
    pattern: /^(?:increase|go up|bump)\s+(?:to|up to)\s+(?<weight>\d+(?:\.\d+)?)\s*(?<unit>lbs?|pounds?|kg|kilos?)?\.?$/i,
    build: (m, text) => ({
      intent: 'adjust_weight',
      weightAdjustment: 'increase',
      targetWeight: parseFloat(m.groups!.weight!),
      weightUnit: detectWeightUnit(m.groups!.unit ?? text) ?? detectWeightUnit(text),
      rawText: text,
      confidence: 0.94,
    }),
  },
  {
    pattern: /^(?:reduce|decrease|lower|drop)\s+(?:to|down to)\s+(?<weight>\d+(?:\.\d+)?)\s*(?<unit>lbs?|pounds?|kg|kilos?)?\.?$/i,
    build: (m, text) => ({
      intent: 'adjust_weight',
      weightAdjustment: 'decrease',
      targetWeight: parseFloat(m.groups!.weight!),
      weightUnit: detectWeightUnit(m.groups!.unit ?? text) ?? detectWeightUnit(text),
      rawText: text,
      confidence: 0.94,
    }),
  },
  {
    pattern: /^(?:increase|add|go up)\s+(?:the\s+)?weight\.?$/i,
    build: (_, text) => ({
      intent: 'adjust_weight',
      weightAdjustment: 'increase',
      rawText: text,
      confidence: 0.92,
    }),
  },
  {
    pattern: /^(?:reduce|decrease|lower|drop)\s+(?:the\s+)?weight\.?$/i,
    build: (_, text) => ({
      intent: 'adjust_weight',
      weightAdjustment: 'decrease',
      rawText: text,
      confidence: 0.92,
    }),
  },
  {
    pattern: /^(?:same\s+weight|same)\s+(?:for|x|\*|×)\s*(?<reps>\d+)\s*reps?\.?$/i,
    build: (m, text, ctx) => ({
      intent: 'log_set',
      exercise: ctx.activeExerciseName,
      weight: ctx.lastWeight,
      reps: parseInt(m.groups!.reps!, 10),
      usesContextWeight: true,
      usesContextExercise: !ctx.activeExerciseName,
      rawText: text,
      confidence: ctx.lastWeight != null ? 0.91 : 0.65,
    }),
  },
  {
    pattern: /^(?:got|did|hit)\s+(?<reps>\d+)\s*reps?\.?$/i,
    build: (m, text, ctx) => ({
      intent: 'log_set',
      exercise: ctx.activeExerciseName,
      weight: ctx.lastWeight,
      reps: parseInt(m.groups!.reps!, 10),
      usesContextWeight: ctx.lastWeight != null,
      usesContextExercise: !ctx.activeExerciseName,
      rawText: text,
      confidence: 0.88,
    }),
  },
  {
    pattern:
      /^(?<weight>\d+(?:\.\d+)?)\s*(?<unit>lbs?|pounds?|kg|kilos?)?\s*(?:for|x|\*|×)\s*(?<reps>\d+)\s*reps?\.?$/i,
    build: (m, text, ctx) => ({
      intent: 'log_set',
      exercise: ctx.activeExerciseName,
      weight: parseFloat(m.groups!.weight!),
      reps: parseInt(m.groups!.reps!, 10),
      weightUnit: detectWeightUnit(m.groups!.unit ?? text) ?? detectWeightUnit(text),
      usesContextExercise: !ctx.activeExerciseName,
      rawText: text,
      confidence: ctx.activeExerciseName ? 0.89 : 0.7,
    }),
  },
  {
    pattern:
      /^(?<reps>\d+)\s*reps?\s*(?:at|@)\s*(?<weight>\d+(?:\.\d+)?)\s*(?<unit>lbs?|pounds?|kg|kilos?)?\.?$/i,
    build: (m, text, ctx) => ({
      intent: 'log_set',
      exercise: ctx.activeExerciseName,
      weight: parseFloat(m.groups!.weight!),
      reps: parseInt(m.groups!.reps!, 10),
      weightUnit: detectWeightUnit(m.groups!.unit ?? text) ?? detectWeightUnit(text),
      usesContextExercise: !ctx.activeExerciseName,
      rawText: text,
      confidence: ctx.activeExerciseName ? 0.89 : 0.7,
    }),
  },
  {
    pattern: /^(?<exercise>.+?)\s+(?:felt|feels?)\s+easy\.?$/i,
    build: (m, text) => ({
      intent: 'feedback',
      exercise: cleanExerciseName(m.groups!.exercise),
      feedback: 'easy',
      rawText: text,
      confidence: 0.9,
    }),
  },
  {
    pattern: /^(?<exercise>.+?)\s+(?:felt|feels?)\s+(?:hard|heavy)\.?$/i,
    build: (m, text) => ({
      intent: 'feedback',
      exercise: cleanExerciseName(m.groups!.exercise),
      feedback: 'hard',
      rawText: text,
      confidence: 0.9,
    }),
  },
  {
    pattern: /^(?:failed|missed)\s+(?:at\s+)?(?<reps>\d+)\s*reps?\.?$/i,
    build: (m, text) => ({
      intent: 'feedback',
      feedback: 'failed',
      reps: parseInt(m.groups!.reps!, 10),
      rawText: text,
      confidence: 0.9,
    }),
  },
];

type SetPattern = {
  pattern: RegExp;
  confidence: number;
  /** True when the wording itself says which number is weight and which is reps. */
  orderExplicit: boolean;
};

const SET_PATTERNS: SetPattern[] = [
  {
    pattern:
      /^(?<exercise>.+?)\s+(?<weight>\d+(?:\.\d+)?)\s*(?<unit>lbs?|pounds?|kg|kilos?)?\s*(?:for|x|\*|×)\s*(?<reps>\d+)/i,
    confidence: 0.92,
    orderExplicit: true,
  },
  {
    pattern:
      /^(?<exercise>.+?)\s+(?<reps>\d+)\s*(?:reps?|rep)\s*(?:at|@)\s*(?<weight>\d+(?:\.\d+)?)\s*(?<unit>lbs?|pounds?|kg|kilos?)?/i,
    confidence: 0.9,
    orderExplicit: true,
  },
  {
    // "bench press 225 8" — only a unit on the first number says which one is the weight.
    pattern: /^(?<exercise>.+?)\s+(?<weight>\d+(?:\.\d+)?)\s*(?<unit>lbs?|pounds?|kg|kilos?)?\s+(?<reps>\d+)/i,
    confidence: 0.88,
    orderExplicit: false,
  },
  {
    pattern: /^(?<exercise>.+?)\s+(?<reps>\d+)\s*reps?$/i,
    confidence: 0.72,
    orderExplicit: true,
  },
];

/**
 * Applies the checks that must run on every set regardless of which pattern (or the LLM)
 * produced it: name cleanup, range validation, and the confidence ceilings that force
 * confirmation when a value was guessed rather than heard.
 */
function finalizeSetCommand(command: ParsedCommand, remainder = ''): ParsedCommand {
  const next: ParsedCommand = { ...command };

  if (next.exercise) {
    const cleaned = cleanExerciseName(next.exercise);
    next.exercise = looksLikeNonExercise(cleaned) ? undefined : cleaned;
  }

  if (hasAdditionalSets(remainder)) {
    next.multipleSetsHeard = true;
    next.validationReason = 'Heard more than one set — only the first was parsed. Please confirm.';
    next.confidence = Math.min(next.confidence ?? 1, TRUNCATED_CONFIDENCE);
  }

  if (next.ambiguousOrder) {
    next.confidence = Math.min(next.confidence ?? 1, AMBIGUOUS_CONFIDENCE);
    next.validationReason ??= 'Could not tell weight from reps — please confirm.';
  }

  const check = checkSetValues({ weight: next.weight, reps: next.reps, weightUnit: next.weightUnit });
  if (check.implausible) {
    next.implausible = true;
    next.validationReason = check.validationReason;
    next.confidence = Math.min(next.confidence ?? 1, check.confidenceCeiling ?? IMPLAUSIBLE_CONFIDENCE);
  }

  return next;
}

export function parseVoiceTranscript(transcript: string, context: VoiceParseContext = {}): ParsedCommand | null {
  const raw = transcript.trim();
  if (!raw) return null;
  // Real speech ends in politeness and punctuation; the `$` anchors below must not see it.
  const matchable = stripTrailingFiller(raw);
  if (!matchable) return null;
  const text = matchable.toLowerCase();

  for (const { pattern, build } of COACHING_PATTERNS) {
    const match = text.match(pattern) ?? matchable.match(pattern);
    if (match) {
      const built = build(match, raw, context);
      return built.intent === 'log_set' ? finalizeSetCommand(built) : built;
    }
  }

  for (const { pattern, confidence, orderExplicit } of SET_PATTERNS) {
    const match = text.match(pattern) ?? matchable.match(pattern);
    if (!match?.groups) continue;

    const weightUnit = detectWeightUnit(match.groups.unit ?? raw) ?? detectWeightUnit(raw);
    const first = match.groups.weight != null ? parseFloat(match.groups.weight) : undefined;
    const second = match.groups.reps != null ? parseInt(match.groups.reps, 10) : undefined;

    let weight = first;
    let reps = second;
    let ambiguousOrder = false;
    if (!orderExplicit && !match.groups.unit && first != null && second != null) {
      ({ weight, reps } = orderWeightAndReps(first, second));
      ambiguousOrder = true;
    }

    const remainder = matchable.slice((match.index ?? 0) + match[0].length);
    return finalizeSetCommand(
      {
        intent: 'log_set',
        exercise: match.groups.exercise,
        weight,
        reps,
        weightUnit,
        ambiguousOrder,
        rawText: raw,
        confidence,
      },
      remainder,
    );
  }

  return null;
}

export function enrichParsedCommand(parsed: ParsedCommand, context: VoiceParseContext): ParsedCommand {
  const next = { ...parsed };
  if (!next.intent) next.intent = 'log_set';
  if (!next.exercise && context.activeExerciseName && (next.usesContextExercise || next.intent === 'log_set')) {
    next.exercise = cleanExerciseName(context.activeExerciseName);
  }
  if (next.weight == null && next.usesContextWeight && context.lastWeight != null) {
    next.weight = context.lastWeight;
  }
  return next;
}

export function buildParseResponse(parsed: ParsedCommand, context: VoiceParseContext) {
  const confidence = parsed.confidence ?? 0.85;
  const { requiresConfirmation, confirmationReason } = resolveRequiresConfirmation({
    confidence,
    confirmationMode: context.confirmationMode ?? 'smart',
    autoLog: context.autoLog !== false,
    blockAutoCommit: parsed.implausible === true,
    blockReason: parsed.validationReason,
  });
  return { parsed, confidence, requiresConfirmation, confirmationReason };
}

const LLM_SYSTEM_PROMPT = [
  'You convert a single spoken gym command into JSON. Respond with JSON only, shaped as:',
  '{ "exercise": string|null, "weight": number|null, "reps": number|null, "confidence": number,',
  `  "intent": one of ${VOICE_INTENTS.join('|')}, "feedback": "easy"|"hard"|"failed"|null,`,
  '  "weightAdjustment": "increase"|"decrease"|null, "targetWeight": number|null }',
  'Rules:',
  '- Weight is in pounds unless the speaker says kg or kilos.',
  '- Phrases describing how a set went ("failed at 3 reps", "missed 2", "bench press felt easy",',
  '  "that was hard") are intent "feedback". Never turn such a phrase into an exercise name:',
  '  "failed at", "got", "did", "same" and similar are not exercises. Use null for exercise if',
  '  the speaker did not name one.',
  `- reps must be a whole number between 1 and ${REPS_MAX}; weight must be between 0 and ${WEIGHT_MAX_LB} lb`,
  `  (${WEIGHT_MAX_KG} kg). If what you heard falls outside that, report your true low confidence.`,
  '- confidence is your own honest estimate between 0 and 1.',
].join('\n');

function coerceNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function coerceEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

/**
 * `JSON.parse` hands back `any`, so nothing about the model's output is guaranteed. Every field
 * is re-established here before it can enter `ParsedCommand`, and the model's self-reported
 * confidence is capped below the confirmation gate — a hallucinated parse must not be able to
 * vote itself past the user.
 */
export function validateLlmCommand(
  raw: unknown,
  transcript: string,
  context: VoiceParseContext,
): ParsedCommand | null {
  // An array passes `typeof === 'object'` and would otherwise read as a command with no fields.
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const p = raw as Record<string, unknown>;

  const intent = coerceEnum(p.intent, VOICE_INTENTS) ?? 'log_set';
  const reportedConfidence = coerceNumber(p.confidence);
  const confidence = Math.min(
    LLM_MAX_CONFIDENCE,
    Math.max(0, Math.min(1, reportedConfidence ?? LLM_MAX_CONFIDENCE)),
  );

  const rawExercise = typeof p.exercise === 'string' ? cleanExerciseName(p.exercise) : undefined;
  const reps = coerceNumber(p.reps);

  const command: ParsedCommand = {
    intent,
    exercise: looksLikeNonExercise(rawExercise) ? undefined : rawExercise,
    weight: coerceNumber(p.weight),
    reps: reps == null ? undefined : Math.round(reps),
    confidence,
    feedback: coerceEnum(p.feedback, ['easy', 'hard', 'failed'] as const),
    weightAdjustment: coerceEnum(p.weightAdjustment, ['increase', 'decrease'] as const),
    targetWeight: coerceNumber(p.targetWeight),
    weightUnit: detectWeightUnit(transcript),
    rawText: transcript,
  };

  const finalized = intent === 'log_set' ? finalizeSetCommand(command) : command;
  return enrichParsedCommand(finalized, context);
}

export async function parseWithOpenAI(transcript: string, context: VoiceParseContext = {}): Promise<ParsedCommand | null> {
  const heuristic = parseVoiceTranscript(transcript, context);

  // chatCompletionJson swallows provider failures (timeout, rate limit, outage, bad JSON) and
  // returns null, so a provider incident degrades to the regex parse instead of a 500.
  const raw = await chatCompletionJson<unknown>({
    system: LLM_SYSTEM_PROMPT,
    user: [
      asPromptData('VOICE TRANSCRIPT', transcript.slice(0, MAX_TRANSCRIPT_CHARS)),
      asPromptData('WORKOUT CONTEXT', {
        activeExercise: context.activeExerciseName ?? null,
        lastWeight: context.lastWeight ?? null,
        lastReps: context.lastReps ?? null,
        preferredWeightUnit: context.preferredWeightUnit ?? null,
      }),
    ].join('\n\n'),
    temperature: 0,
    maxTokens: 300,
  });
  if (raw === null) return heuristic;

  return validateLlmCommand(raw, transcript, context) ?? heuristic;
}
