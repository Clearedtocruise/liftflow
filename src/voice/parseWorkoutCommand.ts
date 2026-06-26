import type { ParsedVoiceCommandExtended } from '@/types/voice';

import { normalizeVoiceTranscript } from '@/lib/voice/normalizeSpokenNumbers';

import type { ParsedWorkoutCommand, WorkoutVoiceIntent } from './workoutCommandTypes';

export type WorkoutParseContext = {
  activeExerciseName?: string;
};

function normalizeText(text: string): string {
  return normalizeVoiceTranscript(text);
}

function cleanExerciseName(name: string): string {
  return name
    .replace(/\bfor\b/g, '')
    .replace(/\breps?\b/g, '')
    .replace(/\blb\b/g, '')
    .replace(/\bkg\b/g, '')
    .replace(/\d+/g, '')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function parseWeightUnit(unit: string | undefined): 'lb' | 'kg' {
  return unit === 'kg' ? 'kg' : 'lb';
}

function logSetCommand(
  rawText: string,
  exerciseName: string | undefined,
  weight: number,
  reps: number,
  unit: 'lb' | 'kg' | 'bodyweight',
  confidence: number,
): ParsedWorkoutCommand {
  return {
    intent: unit === 'bodyweight' ? 'LOG_BODYWEIGHT_SET' : 'LOG_SET',
    exerciseName: exerciseName ? cleanExerciseName(exerciseName) : undefined,
    weight: unit === 'bodyweight' ? undefined : weight,
    reps,
    unit,
    rawText,
    confidence,
  };
}

/** "45 lb for 8", "45 for 8 reps", "log 45 pounds for 8" — no exercise name in phrase. */
function parseWeightFirstLog(text: string, context?: WorkoutParseContext): ParsedWorkoutCommand | null {
  const withUnitFor = text.match(
    /^(?:log|add|record)?\s*(\d+(?:\.\d+)?)\s*(lb|kg)\s*(?:for|x|\*|×|at)\s*(\d+)\s*(?:reps?)?$/,
  );
  if (withUnitFor) {
    return logSetCommand(
      text,
      context?.activeExerciseName,
      Number(withUnitFor[1]),
      Number(withUnitFor[3]),
      parseWeightUnit(withUnitFor[2]),
      0.94,
    );
  }

  const withUnitOnly = text.match(/^(\d+(?:\.\d+)?)\s*(lb|kg)\s*(?:for|x|\*|×|at)\s*(\d+)\s*(?:reps?)?$/);
  if (withUnitOnly) {
    return logSetCommand(
      text,
      context?.activeExerciseName,
      Number(withUnitOnly[1]),
      Number(withUnitOnly[3]),
      parseWeightUnit(withUnitOnly[2]),
      0.94,
    );
  }

  const withUnitSpaceReps = text.match(/^(\d+(?:\.\d+)?)\s*(lb|kg)\s+(\d+)\s*(?:reps?)?$/);
  if (withUnitSpaceReps) {
    return logSetCommand(
      text,
      context?.activeExerciseName,
      Number(withUnitSpaceReps[1]),
      Number(withUnitSpaceReps[3]),
      parseWeightUnit(withUnitSpaceReps[2]),
      0.93,
    );
  }

  const implicitUnit = text.match(/^(?:log|add|record)?\s*(\d+(?:\.\d+)?)\s*(?:for|x|\*|×|at)\s*(\d+)\s*(?:reps?)?$/);
  if (implicitUnit) {
    return logSetCommand(
      text,
      context?.activeExerciseName,
      Number(implicitUnit[1]),
      Number(implicitUnit[2]),
      'lb',
      0.88,
    );
  }

  return null;
}

/** "bench press 45 lb for 8" — exercise name before weight. */
function parseNamedWeightLog(text: string): ParsedWorkoutCommand | null {
  const match = text.match(
    /^(?:log|add|record)?\s*(.+?)\s+(\d+(?:\.\d+)?)\s*(lb|kg)\s*(?:for|x|\*|×|at)\s*(\d+)\s*(?:reps?)?$/,
  );
  if (!match) return null;

  const weight = Number(match[2]);
  const reps = Number(match[4]);
  if (!Number.isFinite(weight) || !Number.isFinite(reps) || reps <= 0) return null;

  return logSetCommand(text, match[1], weight, reps, parseWeightUnit(match[3]), 0.92);
}

export function parseWorkoutCommand(
  rawText: string,
  context?: WorkoutParseContext,
): ParsedWorkoutCommand {
  const text = normalizeText(rawText);

  if (!text) {
    return { intent: 'UNKNOWN', rawText, confidence: 0 };
  }

  if (text.includes('cancel') || text.includes('nevermind') || text.includes('never mind')) {
    return { intent: 'CANCEL', rawText, confidence: 0.95 };
  }

  if (
    /(?:undo|delete|remove)\s+(?:the\s+)?last\s+set/.test(text) ||
    text.includes('undo last set') ||
    text.includes('delete last set')
  ) {
    return { intent: 'UNDO_LAST_SET', rawText, confidence: 0.95 };
  }

  if (text.includes('finish workout') || text.includes('end workout')) {
    return { intent: 'FINISH_WORKOUT', rawText, confidence: 0.95 };
  }

  if (text.includes('next exercise')) {
    return { intent: 'NEXT_EXERCISE', rawText, confidence: 0.95 };
  }

  if (text.includes('previous exercise') || text.includes('last exercise')) {
    return { intent: 'PREVIOUS_EXERCISE', rawText, confidence: 0.95 };
  }

  if (
    text.includes('how many sets') ||
    text.includes('what set') ||
    text.includes('workout status')
  ) {
    return { intent: 'ASK_STATUS', rawText, confidence: 0.85 };
  }

  const timerMatch = text.match(
    /(?:start|set)?\s*(?:a)?\s*(?:rest)?\s*timer\s*(?:for)?\s*(\d+)\s*(seconds|second|minutes|minute|min)?/,
  );

  if (timerMatch) {
    const amount = Number(timerMatch[1]);
    const unit = timerMatch[2] ?? 'seconds';
    const durationSeconds = unit.startsWith('min') ? amount * 60 : amount;

    return {
      intent: 'START_REST_TIMER',
      durationSeconds,
      rawText,
      confidence: 0.9,
    };
  }

  const replaceMatch = text.match(/replace\s+(.+?)\s+with\s+(.+)/);

  if (replaceMatch) {
    return {
      intent: 'REPLACE_EXERCISE',
      exerciseName: cleanExerciseName(replaceMatch[1]!),
      replacementExerciseName: cleanExerciseName(replaceMatch[2]!),
      rawText,
      confidence: 0.85,
    };
  }

  const weightFirst = parseWeightFirstLog(text, context);
  if (weightFirst) return weightFirst;

  const namedWeight = parseNamedWeightLog(text);
  if (namedWeight) return namedWeight;

  const bodyweightMatch = text.match(
    /(?:log|add|record)?\s*(.+?)\s+(?:bodyweight|body weight)\s*(?:for)?\s*(\d+)\s*(?:reps?)?/,
  );

  if (bodyweightMatch) {
    return {
      intent: 'LOG_BODYWEIGHT_SET',
      exerciseName: cleanExerciseName(bodyweightMatch[1]!),
      reps: Number(bodyweightMatch[2]),
      unit: 'bodyweight',
      rawText,
      confidence: 0.85,
    };
  }

  const repsOnlyMatch = text.match(/(?:log|add|record)?\s*(.+?)\s+(?:for)?\s*(\d+)\s*(?:reps?)$/);

  if (repsOnlyMatch) {
    return {
      intent: 'LOG_BODYWEIGHT_SET',
      exerciseName: cleanExerciseName(repsOnlyMatch[1]!),
      reps: Number(repsOnlyMatch[2]),
      unit: 'bodyweight',
      rawText,
      confidence: 0.7,
    };
  }

  return { intent: 'UNKNOWN', rawText, confidence: 0.1 };
}

/** Map existing ONE MORE voice parser output into workout command intents. */
export function mapExtendedVoiceToWorkoutCommand(
  parsed: ParsedVoiceCommandExtended,
): ParsedWorkoutCommand {
  const rawText = parsed.rawText;
  const confidence = parsed.confidence ?? 0.75;

  const intentMap: Partial<Record<string, WorkoutVoiceIntent>> = {
    log_set: parsed.weight != null ? 'LOG_SET' : 'LOG_BODYWEIGHT_SET',
    completed_set: 'LOG_BODYWEIGHT_SET',
    next_set: 'NEXT_EXERCISE',
    declare_exercise: 'ADD_EXERCISE',
    undo_last_set: 'UNDO_LAST_SET',
    delete_last_set: 'UNDO_LAST_SET',
  };

  const mappedIntent = parsed.intent ? intentMap[parsed.intent] : undefined;

  if (mappedIntent === 'LOG_SET' || mappedIntent === 'LOG_BODYWEIGHT_SET') {
    const defaultReps = parsed.intent === 'completed_set' ? 1 : undefined;
    return {
      intent: mappedIntent,
      exerciseName: parsed.exercise,
      weight: parsed.weight ?? parsed.targetWeight,
      reps: parsed.reps ?? defaultReps,
      unit: parsed.weightUnit ?? (parsed.weight != null ? 'lb' : 'bodyweight'),
      rawText,
      confidence,
    };
  }

  if (mappedIntent) {
    return {
      intent: mappedIntent,
      exerciseName: parsed.exercise,
      rawText,
      confidence,
    };
  }

  return parseWorkoutCommand(rawText);
}
