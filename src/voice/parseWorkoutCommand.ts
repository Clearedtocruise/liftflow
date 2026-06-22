import type { ParsedVoiceCommandExtended } from '@/types/voice';

import type { ParsedWorkoutCommand, WorkoutVoiceIntent } from './workoutCommandTypes';

const numberWords: Record<string, number> = {
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
  twenty: 20,
};

function normalizeText(text: string): string {
  let normalized = text.toLowerCase().trim();

  Object.entries(numberWords).forEach(([word, value]) => {
    normalized = normalized.replace(new RegExp(`\\b${word}\\b`, 'g'), String(value));
  });

  return normalized
    .replace(/pounds/g, 'lb')
    .replace(/lbs/g, 'lb')
    .replace(/kilograms/g, 'kg')
    .replace(/kilos/g, 'kg')
    .replace(/\s+/g, ' ');
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

export function parseWorkoutCommand(rawText: string): ParsedWorkoutCommand {
  const text = normalizeText(rawText);

  if (!text) {
    return { intent: 'UNKNOWN', rawText, confidence: 0 };
  }

  if (text.includes('cancel') || text.includes('nevermind') || text.includes('never mind')) {
    return { intent: 'CANCEL', rawText, confidence: 0.95 };
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

  const weightedMatch = text.match(
    /(?:log|add|record)?\s*(.+?)\s+(\d+)\s*(lb|kg)?\s*(?:for|x)?\s*(\d+)\s*(?:reps?)?/,
  );

  if (weightedMatch) {
    return {
      intent: 'LOG_SET',
      exerciseName: cleanExerciseName(weightedMatch[1]!),
      weight: Number(weightedMatch[2]),
      reps: Number(weightedMatch[4]),
      unit: weightedMatch[3] === 'kg' ? 'kg' : 'lb',
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
    undo_last_set: 'CANCEL',
    delete_last_set: 'CANCEL',
  };

  const mappedIntent = parsed.intent ? intentMap[parsed.intent] : undefined;

  if (mappedIntent === 'LOG_SET' || mappedIntent === 'LOG_BODYWEIGHT_SET') {
    return {
      intent: mappedIntent,
      exerciseName: parsed.exercise,
      weight: parsed.weight ?? parsed.targetWeight,
      reps: parsed.reps,
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
