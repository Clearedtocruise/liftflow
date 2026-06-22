import { mapExtendedVoiceToWorkoutCommand } from './parseWorkoutCommand';
import type {
    ExecuteWorkoutVoiceCommandInput,
    ExecuteWorkoutVoiceCommandResult,
    ParsedWorkoutCommand,
} from './workoutCommandTypes';

/**
 * Executes a parsed workout voice command against live session handlers.
 * Logging runs on-device via WorkoutSessionContext — not a separate API round-trip.
 */
export async function executeWorkoutVoiceCommand(
  input: ExecuteWorkoutVoiceCommandInput,
): Promise<ExecuteWorkoutVoiceCommandResult> {
  const { command, handlers } = input;

  switch (command.intent) {
    case 'CANCEL':
      return { success: true, message: 'Cancelled.' };

    case 'UNKNOWN':
      return { success: false, message: 'I did not understand that. Please try again.' };

    case 'LOG_SET':
    case 'LOG_BODYWEIGHT_SET': {
      if (!command.reps) {
        return { success: false, message: 'Missing rep count.' };
      }
      const result = await handlers.logSet({
        exerciseName: command.exerciseName,
        weight: command.weight,
        weightUnit: command.unit === 'kg' ? 'kg' : command.unit === 'lb' ? 'lb' : undefined,
        reps: command.reps,
        bodyweight: command.intent === 'LOG_BODYWEIGHT_SET' || command.unit === 'bodyweight',
      });
      return {
        success: result.ok,
        message: result.message,
        shouldStartRestTimer: result.shouldStartRestTimer,
      };
    }

    case 'NEXT_EXERCISE': {
      const result = await handlers.nextExercise();
      return { success: result.ok, message: result.message };
    }

    case 'PREVIOUS_EXERCISE': {
      const result = await handlers.previousExercise();
      return { success: result.ok, message: result.message };
    }

    case 'START_REST_TIMER': {
      const seconds = command.durationSeconds ?? 90;
      const result = await handlers.startRestTimer(seconds);
      return { success: result.ok, message: result.message };
    }

    case 'FINISH_WORKOUT': {
      const result = await handlers.finishWorkout();
      return { success: result.ok, message: result.message };
    }

    case 'ASK_STATUS': {
      const result = await handlers.askStatus();
      return { success: result.ok, message: result.message };
    }

    case 'REPLACE_EXERCISE': {
      if (!command.exerciseName || !command.replacementExerciseName) {
        return { success: false, message: 'Missing exercise names for replace.' };
      }
      const result = await handlers.replaceExercise(
        command.exerciseName,
        command.replacementExerciseName,
      );
      return { success: result.ok, message: result.message };
    }

    case 'ADD_EXERCISE':
      return {
        success: false,
        message: command.exerciseName
          ? `Say weight and reps for ${command.exerciseName}, or use manual logging.`
          : 'Name the exercise and reps to log.',
      };

    default:
      return { success: false, message: 'Unknown voice command.' };
  }
}

/** Optional server parse fallback — uses existing /api/voice/parse when online. */
export async function parseWorkoutCommandRemote(
  transcript: string,
  context: Record<string, unknown>,
  authToken?: string,
): Promise<ParsedWorkoutCommand | null> {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!baseUrl) return null;

  try {
    const response = await fetch(`${baseUrl}/api/voice/parse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({ transcript, context }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      parsed?: {
        exercise?: string;
        weight?: number;
        reps?: number;
        intent?: string;
        rawText?: string;
        confidence?: number;
        weightUnit?: 'lb' | 'kg';
      };
      confidence?: number;
    };

    if (!data.parsed) return null;

    return mapExtendedVoiceToWorkoutCommand({
      ...data.parsed,
      rawText: data.parsed.rawText ?? transcript,
      confidence: data.parsed.confidence ?? data.confidence ?? 0.7,
      intent: data.parsed.intent as import('@/types/voice').VoiceIntent | undefined,
    });
  } catch {
    return null;
  }
}
