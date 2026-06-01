import { resolveRequiresConfirmation } from './voiceConfirmation.js';

export type ParsedCommand = {
  exercise?: string;
  weight?: number;
  reps?: number;
  set?: number;
  type?: string;
  confidence?: number;
  rawText: string;
  intent?:
    | 'log_set'
    | 'completed_set'
    | 'adjust_weight'
    | 'feedback'
    | 'undo_last_set'
    | 'delete_last_set'
    | 'next_set'
    | 'declare_exercise'
    | 'recovery_query'
    | 'train_today_query'
    | 'build_workout'
    | 'nutrition_query'
    | 'grocery_list_query'
    | 'coach_query'
    | 'transformation_query'
    | 'transformation_progress'
    | 'transformation_target_bf';
  targetBodyFatPct?: number;
  feedback?: 'easy' | 'hard' | 'failed';
  weightAdjustment?: 'increase' | 'decrease';
  targetWeight?: number;
  weightUnit?: 'lb' | 'kg';
  usesContextWeight?: boolean;
  usesContextExercise?: boolean;
};

export type VoiceParseContext = {
  activeExerciseName?: string;
  lastWeight?: number;
  lastReps?: number;
  preferredWeightUnit?: 'lb' | 'kg';
  confirmationMode?: 'always' | 'smart' | 'none';
  autoLog?: boolean;
};

function detectWeightUnit(text: string): 'lb' | 'kg' | undefined {
  if (/\bkg\b|kilos?\b/i.test(text)) return 'kg';
  if (/\blbs?\b|pounds?\b/i.test(text)) return 'lb';
  return undefined;
}

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
    pattern:
      /^(?:why\s+am\s+i\s+(?:stalled|fatigued|tired)|how\s+much\s+(?:should\s+i\s+)?lift|how\s+much\s+protein|coach\s+help|ask\s+(?:the\s+)?coach)\??$/i,
    build: (_, text) => ({ intent: 'coach_query', rawText: text, confidence: 0.91 }),
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
      exercise: m.groups!.exercise!.trim(),
      rawText: text,
      confidence: 0.9,
    }),
  },
  {
    pattern: /^(?:increase|go up|bump)\s+(?:to|up to)\s+(?<weight>\d+(?:\.\d+)?)\s*(?<unit>lbs?|pounds?|kg|kilos?)?\.?$/i,
    build: (m, text) => ({
      intent: 'adjust_weight',
      weightAdjustment: 'increase',
      targetWeight: parseFloat(m.groups!.weight!),
      weightUnit: detectWeightUnit(m.groups!.unit ?? text),
      rawText: text,
      confidence: 0.94,
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
      rawText: text,
      confidence: 0.88,
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
];

export function parseVoiceTranscript(transcript: string, context: VoiceParseContext = {}): ParsedCommand | null {
  const raw = transcript.trim();
  if (!raw) return null;
  const text = raw.toLowerCase();

  for (const { pattern, build } of COACHING_PATTERNS) {
    const match = text.match(pattern) ?? raw.match(pattern);
    if (match) return build(match, raw, context);
  }

  const patterns = [
    /^(?<exercise>.+?)\s+(?<weight>\d+(?:\.\d+)?)\s*(?<unit>lbs?|pounds?|kg|kilos?)?\s*(?:for|x|\*|×)\s*(?<reps>\d+)/i,
    /^(?<exercise>.+?)\s+(?<reps>\d+)\s*(?:reps?|rep)\s*(?:at|@)\s*(?<weight>\d+(?:\.\d+)?)/i,
    /^(?<exercise>.+?)\s+(?<weight>\d+(?:\.\d+)?)\s+(?<reps>\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern) ?? raw.match(pattern);
    if (match?.groups) {
      return {
        intent: 'log_set',
        exercise: match.groups.exercise.trim(),
        weight: parseFloat(match.groups.weight),
        reps: parseInt(match.groups.reps, 10),
        weightUnit: detectWeightUnit(match.groups.unit ?? raw),
        rawText: raw,
        confidence: 0.9,
      };
    }
  }

  const repsOnly = text.match(/^(?<exercise>.+?)\s+(?<reps>\d+)\s*reps?$/i);
  if (repsOnly?.groups) {
    return {
      intent: 'log_set',
      exercise: repsOnly.groups.exercise.trim(),
      reps: parseInt(repsOnly.groups.reps, 10),
      rawText: raw,
      confidence: 0.75,
    };
  }

  return null;
}

export function enrichParsedCommand(parsed: ParsedCommand, context: VoiceParseContext): ParsedCommand {
  const next = { ...parsed };
  if (!next.intent) next.intent = 'log_set';
  if (!next.exercise && context.activeExerciseName) next.exercise = context.activeExerciseName;
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
  });
  return { parsed, confidence, requiresConfirmation, confirmationReason };
}

export async function parseWithOpenAI(transcript: string, context: VoiceParseContext = {}): Promise<ParsedCommand | null> {
  const { getOpenAI } = await import('./openai.js');
  const openai = getOpenAI();
  if (!openai) return parseVoiceTranscript(transcript, context);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Parse gym voice into JSON: { "exercise": string|null, "weight": number|null, "reps": number|null, "confidence": number, "intent": "log_set"|"completed_set"|"adjust_weight"|"feedback"|"undo_last_set"|"next_set"|"declare_exercise"|null, "feedback": "easy"|"hard"|"failed"|null, "weightAdjustment": "increase"|"decrease"|null, "targetWeight": number|null }. Context: activeExercise=${context.activeExerciseName ?? 'none'}, lastWeight=${context.lastWeight ?? 'none'}. Weight in lbs unless kg specified.`,
      },
      { role: 'user', content: transcript },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) return parseVoiceTranscript(transcript, context);

  try {
    const p = JSON.parse(content);
    return enrichParsedCommand(
      {
        exercise: p.exercise ?? undefined,
        weight: p.weight ?? undefined,
        reps: p.reps ?? undefined,
        confidence: p.confidence ?? 0.85,
        intent: p.intent ?? 'log_set',
        feedback: p.feedback ?? undefined,
        weightAdjustment: p.weightAdjustment ?? undefined,
        targetWeight: p.targetWeight ?? undefined,
        rawText: transcript,
      },
      context,
    );
  } catch {
    return parseVoiceTranscript(transcript, context);
  }
}
