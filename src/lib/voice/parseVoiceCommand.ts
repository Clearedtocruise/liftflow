import type { ParsedVoiceCommandExtended, VoiceIntent, VoiceParseContext } from '@/types/voice';

import { normalizeVoiceTranscript } from '@/lib/voice/normalizeSpokenNumbers';

function detectWeightUnit(text: string): 'lb' | 'kg' | undefined {
  if (/\bkg\b|kilos?\b/i.test(text)) return 'kg';
  if (/\blbs?\b|pounds?\b/i.test(text)) return 'lb';
  return undefined;
}

type PatternDef = {
  pattern: RegExp;
  build: (match: RegExpMatchArray, raw: string, ctx: VoiceParseContext) => ParsedVoiceCommandExtended | null;
};

const CONTROL_PATTERNS: PatternDef[] = [
  {
    pattern: /^(?:how\s+recovered\s+am\s+i|how(?:'s|\s+is)\s+my\s+recovery|what(?:'s|\s+is)\s+my\s+recovery\s+score)\??$/i,
    build: (_, raw) => ({ intent: 'recovery_query', rawText: raw, confidence: 0.95 }),
  },
  {
    pattern: /^(?:what\s+should\s+i\s+train\s+today|what\s+muscles?\s+should\s+i\s+train|what\s+should\s+i\s+work\s+out\s+today)\??$/i,
    build: (_, raw) => ({ intent: 'train_today_query', rawText: raw, confidence: 0.94 }),
  },
  {
    pattern: /^(?:build\s+(?:me\s+)?(?:a\s+)?workout|create\s+(?:me\s+)?(?:a\s+)?workout|generate\s+(?:me\s+)?(?:a\s+)?workout)\.?$/i,
    build: (_, raw) => ({ intent: 'build_workout', rawText: raw, confidence: 0.93 }),
  },
  {
    pattern: /^(?:what\s+should\s+i\s+eat\s+today|what\s+do\s+i\s+eat\s+today|what\s+should\s+i\s+eat)\??$/i,
    build: (_, raw) => ({ intent: 'nutrition_query', rawText: raw, confidence: 0.94 }),
  },
  {
    pattern: /^(?:build\s+(?:my\s+)?shopping\s+list|create\s+(?:my\s+)?(?:grocery|shopping)\s+list|generate\s+(?:my\s+)?grocery\s+list)\.?$/i,
    build: (_, raw) => ({ intent: 'grocery_list_query', rawText: raw, confidence: 0.93 }),
  },
  {
    pattern: /^(?:play\s+(?:the\s+)?good\s+part|hit\s+(?:the\s+)?good\s+part)\.?$/i,
    build: (_, raw) => ({ intent: 'play_peak', rawText: raw, confidence: 0.92 }),
  },
  {
    pattern: /^(?:start\s+at\s+(?:the\s+)?chorus|play\s+(?:the\s+)?chorus)\.?$/i,
    build: (_, raw) => ({ intent: 'start_at_chorus', rawText: raw, confidence: 0.91 }),
  },
  {
    pattern: /^(?:sync\s+with\s+next\s+set|sync\s+(?:to\s+)?next\s+set|sync\s+music\s+to\s+next\s+set|peak\s+sync)\.?$/i,
    build: (_, raw) => ({ intent: 'sync_music_next_set', rawText: raw, confidence: 0.9 }),
  },
  {
    pattern: /^(?:use\s+(?:a\s+)?pr\s+song|play\s+pr\s+song)\.?$/i,
    build: (_, raw) => ({ intent: 'use_pr_song', rawText: raw, confidence: 0.91 }),
  },
  {
    pattern: /^(?:resume\s+(?:my\s+)?playlist|go\s+back\s+to\s+(?:my\s+)?playlist)\.?$/i,
    build: (_, raw) => ({ intent: 'resume_playlist', rawText: raw, confidence: 0.9 }),
  },
  {
    pattern: /^(?:next\s+hype\s+song|next\s+hype\s+track|play\s+next\s+hype)\.?$/i,
    build: (_, raw) => ({ intent: 'next_hype_song', rawText: raw, confidence: 0.89 }),
  },
  {
    pattern: /^(?:show\s+(?:my\s+)?projection|show\s+(?:my\s+)?transformation|my\s+transformation)\??$/i,
    build: (_, raw) => ({ intent: 'transformation_query', rawText: raw, confidence: 0.93 }),
  },
  {
    pattern: /^(?:show\s+(?:my\s+)?progress|my\s+progress\s+photos?)\??$/i,
    build: (_, raw) => ({ intent: 'transformation_progress', rawText: raw, confidence: 0.92 }),
  },
  {
    pattern:
      /^(?:what\s+will\s+i\s+look\s+like\s+at\s+(?<bf>\d{1,2})(?:\s*(?:%|percent))?\s*(?:body\s*fat|bf)?|project(?:ion)?\s+(?:to|at)\s+(?<bf2>\d{1,2})\s*(?:%|percent)?)\??$/i,
    build: (m, raw) => ({
      intent: 'transformation_target_bf',
      rawText: raw,
      confidence: 0.92,
      targetBodyFatPct: Number(m.groups!.bf ?? m.groups!.bf2),
    }),
  },
  {
    pattern:
      /^(?:why\s+am\s+i\s+(?:stalled|fatigued|tired)|how\s+much\s+(?:should\s+i\s+)?lift|how\s+much\s+protein|coach\s+help|ask\s+(?:the\s+)?coach)\??$/i,
    build: (_, raw) => ({ intent: 'coach_query', rawText: raw, confidence: 0.91 }),
  },
  {
    pattern: /^(?:undo|delete)\s+(?:the\s+)?last\s+set\.?$/i,
    build: (_, raw) => ({ intent: 'undo_last_set', rawText: raw, confidence: 0.96 }),
  },
  {
    pattern: /^undo\.?$/i,
    build: (_, raw) => ({ intent: 'undo_last_set', rawText: raw, confidence: 0.94 }),
  },
  {
    pattern: /^(?:scratch that|remove that|take that back)\.?$/i,
    build: (_, raw) => ({ intent: 'undo_last_set', rawText: raw, confidence: 0.93 }),
  },
  {
    pattern: /^(?:next\s+set|next)\.?$/i,
    build: (_, raw) => ({ intent: 'next_set', rawText: raw, confidence: 0.93 }),
  },
  {
    pattern: /^(?:completed|finished)\s+(?:the\s+)?set\.?$/i,
    build: (_, raw) => ({ intent: 'completed_set', rawText: raw, confidence: 0.92 }),
  },
  {
    pattern: /^(?:i'm|im|i am)\s+(?:doing|starting|on)\s+(?<exercise>.+?)\.?$/i,
    build: (m, raw) => ({
      intent: 'declare_exercise',
      exercise: m.groups!.exercise!.trim(),
      rawText: raw,
      confidence: 0.9,
    }),
  },
  {
    pattern: /^(?:starting|switching to)\s+(?<exercise>.+?)\.?$/i,
    build: (m, raw) => ({
      intent: 'declare_exercise',
      exercise: m.groups!.exercise!.trim(),
      rawText: raw,
      confidence: 0.88,
    }),
  },
  {
    pattern: /^(?:increase|go up|bump)\s+(?:to|up to)\s+(?<weight>\d+(?:\.\d+)?)\s*(?<unit>lbs?|pounds?|kg|kilos?)?\.?$/i,
    build: (m, raw) => ({
      intent: 'adjust_weight',
      weightAdjustment: 'increase',
      targetWeight: parseFloat(m.groups!.weight!),
      weightUnit: detectWeightUnit(m.groups!.unit ?? raw) ?? detectWeightUnit(raw),
      rawText: raw,
      confidence: 0.94,
    }),
  },
  {
    pattern: /^(?:reduce|decrease|lower|drop)\s+(?:to|down to)\s+(?<weight>\d+(?:\.\d+)?)\s*(?<unit>lbs?|pounds?|kg|kilos?)?\.?$/i,
    build: (m, raw) => ({
      intent: 'adjust_weight',
      weightAdjustment: 'decrease',
      targetWeight: parseFloat(m.groups!.weight!),
      weightUnit: detectWeightUnit(m.groups!.unit ?? raw) ?? detectWeightUnit(raw),
      rawText: raw,
      confidence: 0.94,
    }),
  },
  {
    pattern: /^(?:increase|add|go up)\s+(?:the\s+)?weight\.?$/i,
    build: (_, raw) => ({
      intent: 'adjust_weight',
      weightAdjustment: 'increase',
      rawText: raw,
      confidence: 0.92,
    }),
  },
  {
    pattern: /^(?:reduce|decrease|lower|drop)\s+(?:the\s+)?weight\.?$/i,
    build: (_, raw) => ({
      intent: 'adjust_weight',
      weightAdjustment: 'decrease',
      rawText: raw,
      confidence: 0.92,
    }),
  },
  {
    pattern: /^(?:same\s+weight|same)\s+(?:for|x|\*|×)\s*(?<reps>\d+)\s*reps?\.?$/i,
    build: (m, raw, ctx) => ({
      intent: 'log_set',
      exercise: ctx.activeExerciseName,
      weight: ctx.lastWeight,
      reps: parseInt(m.groups!.reps!, 10),
      usesContextWeight: true,
      usesContextExercise: !ctx.activeExerciseName,
      rawText: raw,
      confidence: ctx.lastWeight != null ? 0.91 : 0.65,
    }),
  },
  {
    pattern: /^(?:got|did|hit)\s+(?<reps>\d+)\s*reps?\.?$/i,
    build: (m, raw, ctx) => ({
      intent: 'log_set',
      exercise: ctx.activeExerciseName,
      weight: ctx.lastWeight,
      reps: parseInt(m.groups!.reps!, 10),
      usesContextWeight: ctx.lastWeight != null,
      usesContextExercise: !ctx.activeExerciseName,
      rawText: raw,
      confidence: 0.88,
    }),
  },
  {
    pattern: /^(?<exercise>.+?)\s+(?:felt|feels?)\s+easy\.?$/i,
    build: (m, raw) => ({
      intent: 'feedback',
      exercise: m.groups!.exercise!.trim(),
      feedback: 'easy',
      rawText: raw,
      confidence: 0.9,
    }),
  },
  {
    pattern: /^(?<exercise>.+?)\s+(?:felt|feels?)\s+(?:hard|heavy)\.?$/i,
    build: (m, raw) => ({
      intent: 'feedback',
      exercise: m.groups!.exercise!.trim(),
      feedback: 'hard',
      rawText: raw,
      confidence: 0.9,
    }),
  },
  {
    pattern: /^(?:failed|missed)\s+(?:at\s+)?(?<reps>\d+)\s*reps?\.?$/i,
    build: (m, raw) => ({
      intent: 'feedback',
      feedback: 'failed',
      reps: parseInt(m.groups!.reps!, 10),
      rawText: raw,
      confidence: 0.9,
    }),
  },
];

const SET_PATTERNS: PatternDef[] = [
  {
    pattern:
      /^(?<weight>\d+(?:\.\d+)?)\s*(?<unit>lbs?|pounds?|kg|kilos?)\s*(?:for|x|\*|×|at)\s*(?<reps>\d+)\s*reps?\.?$/i,
    build: (m, raw, ctx) => ({
      intent: 'log_set',
      exercise: ctx.activeExerciseName,
      weight: parseFloat(m.groups!.weight!),
      reps: parseInt(m.groups!.reps!, 10),
      weightUnit: detectWeightUnit(m.groups!.unit ?? raw) ?? detectWeightUnit(raw),
      usesContextExercise: !ctx.activeExerciseName,
      rawText: raw,
      confidence: ctx.activeExerciseName ? 0.94 : 0.8,
    }),
  },
  {
    // "135 for 8" / "135 x 8" after spoken-number normalize
    pattern: /^(?<weight>\d+(?:\.\d+)?)\s*(?:for|x|\*|×|at)\s*(?<reps>\d+)(?:\s*reps?)?\.?$/i,
    build: (m, raw, ctx) => ({
      intent: 'log_set',
      exercise: ctx.activeExerciseName,
      weight: parseFloat(m.groups!.weight!),
      reps: parseInt(m.groups!.reps!, 10),
      weightUnit: detectWeightUnit(raw) ?? ctx.preferredWeightUnit,
      usesContextExercise: !ctx.activeExerciseName,
      rawText: raw,
      confidence: ctx.activeExerciseName ? 0.92 : 0.78,
    }),
  },
  {
    pattern: /^(?<reps>\d+)\s*reps?\s*(?:at|@)\s*(?<weight>\d+(?:\.\d+)?)\s*(?<unit>lbs?|pounds?|kg|kilos?)?\.?$/i,
    build: (m, raw, ctx) => ({
      intent: 'log_set',
      exercise: ctx.activeExerciseName,
      weight: parseFloat(m.groups!.weight!),
      reps: parseInt(m.groups!.reps!, 10),
      weightUnit: detectWeightUnit(m.groups!.unit ?? raw) ?? detectWeightUnit(raw),
      usesContextExercise: !ctx.activeExerciseName,
      rawText: raw,
      confidence: ctx.activeExerciseName ? 0.93 : 0.78,
    }),
  },
  {
    pattern: /^(?<reps>\d+)\s*reps?\.?$/i,
    build: (m, raw, ctx) => ({
      intent: 'log_set',
      exercise: ctx.activeExerciseName,
      weight: ctx.lastWeight,
      reps: parseInt(m.groups!.reps!, 10),
      usesContextWeight: ctx.lastWeight != null,
      usesContextExercise: !ctx.activeExerciseName,
      rawText: raw,
      confidence: 0.85,
    }),
  },
  {
    pattern:
      /^(?<exercise>.+?)\s+(?<weight>\d+(?:\.\d+)?)\s*(?<unit>lbs?|pounds?|kg|kilos?)?\s*(?:for|x|\*|×)\s*(?<reps>\d+)/i,
    build: (m, raw) => ({
      intent: 'log_set',
      exercise: m.groups!.exercise!.trim(),
      weight: parseFloat(m.groups!.weight!),
      reps: parseInt(m.groups!.reps!, 10),
      weightUnit: detectWeightUnit(m.groups!.unit ?? raw) ?? detectWeightUnit(raw),
      rawText: raw,
      confidence: 0.92,
    }),
  },
  {
    pattern:
      /^(?<exercise>.+?)\s+(?<reps>\d+)\s*(?:reps?|rep)\s*(?:at|@)\s*(?<weight>\d+(?:\.\d+)?)\s*(?<unit>lbs?|pounds?|kg|kilos?)?/i,
    build: (m, raw) => ({
      intent: 'log_set',
      exercise: m.groups!.exercise!.trim(),
      weight: parseFloat(m.groups!.weight!),
      reps: parseInt(m.groups!.reps!, 10),
      weightUnit: detectWeightUnit(m.groups!.unit ?? raw) ?? detectWeightUnit(raw),
      rawText: raw,
      confidence: 0.9,
    }),
  },
  {
    pattern: /^(?<exercise>.+?)\s+(?<weight>\d+(?:\.\d+)?)\s*(?<unit>lbs?|pounds?|kg|kilos?)?\s+(?<reps>\d+)/i,
    build: (m, raw) => ({
      intent: 'log_set',
      exercise: m.groups!.exercise!.trim(),
      weight: parseFloat(m.groups!.weight!),
      reps: parseInt(m.groups!.reps!, 10),
      weightUnit: detectWeightUnit(m.groups!.unit ?? raw) ?? detectWeightUnit(raw),
      rawText: raw,
      confidence: 0.88,
    }),
  },
  {
    pattern: /^(?<exercise>.+?)\s+(?<reps>\d+)\s*reps?$/i,
    build: (m, raw) => ({
      intent: 'log_set',
      exercise: m.groups!.exercise!.trim(),
      reps: parseInt(m.groups!.reps!, 10),
      rawText: raw,
      confidence: 0.72,
    }),
  },
];

export function parseVoiceCommandLocal(
  transcript: string,
  context: VoiceParseContext = {},
): ParsedVoiceCommandExtended | null {
  const raw = transcript.trim();
  if (!raw) return null;
  const normalized = normalizeVoiceTranscript(raw);
  const candidates = [...new Set([normalized, raw.toLowerCase(), raw])];

  for (const text of candidates) {
    for (const { pattern, build } of CONTROL_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        const result = build(match, raw, context);
        if (result) return result;
      }
    }
  }

  for (const text of candidates) {
    for (const { pattern, build } of SET_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        const result = build(match, raw, context);
        if (result) return result;
      }
    }
  }

  return null;
}

export function enrichParsedCommand(
  parsed: ParsedVoiceCommandExtended,
  context: VoiceParseContext,
): ParsedVoiceCommandExtended {
  const next = { ...parsed };
  if (!next.intent) next.intent = 'log_set';
  if (!next.exercise && context.activeExerciseName && (next.usesContextExercise || next.intent === 'log_set')) {
    next.exercise = context.activeExerciseName;
  }
  if (next.weight == null && next.usesContextWeight && context.lastWeight != null) {
    next.weight = context.lastWeight;
  }
  if (next.reps == null && context.lastReps != null && next.intent === 'log_set' && next.usesContextWeight) {
    next.reps = context.lastReps;
  }
  return next;
}

export function intentLabel(intent?: VoiceIntent): string {
  switch (intent) {
    case 'undo_last_set':
    case 'delete_last_set':
      return 'Undo last set';
    case 'next_set':
      return 'Next set';
    case 'completed_set':
      return 'Complete set';
    case 'declare_exercise':
      return 'Set exercise';
    case 'adjust_weight':
      return 'Adjust weight';
    case 'feedback':
      return 'Feedback';
    case 'recovery_query':
      return 'Recovery status';
    case 'train_today_query':
      return 'Train today';
    case 'build_workout':
      return 'Build workout';
    case 'nutrition_query':
      return 'Eat today';
    case 'grocery_list_query':
      return 'Shopping list';
    case 'coach_query':
      return 'Ask coach';
    case 'play_peak':
      return 'Play peak';
    case 'start_at_chorus':
      return 'Start at chorus';
    case 'sync_next_set':
    case 'sync_music_next_set':
      return 'Sync music';
    case 'use_pr_song':
      return 'PR song';
    case 'resume_playlist':
      return 'Resume playlist';
    case 'next_hype_song':
      return 'Next hype';
    case 'transformation_query':
      return 'Show transformation';
    case 'transformation_progress':
      return 'Show progress';
    case 'transformation_target_bf':
      return 'Target body fat projection';
    default:
      return 'Log set';
  }
}
