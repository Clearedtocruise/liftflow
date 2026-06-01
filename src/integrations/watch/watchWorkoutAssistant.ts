import { getConfidenceThreshold, isMotionTrackingSupported, resolveExerciseProfile } from './exerciseMotionProfiles';
import { detectRepsFromMotion } from './repCounter';
import type {
    RepDetectionResult,
    WatchActiveSetState,
    WatchMotionSample,
    WatchVoiceCommandResult,
    WatchWorkoutAssistantState,
} from './types';
import { parseWatchVoiceCommand, type WatchVoiceContext } from './watchVoiceCommands';

export type StartWatchSetInput = {
  userId: string;
  workoutSessionId: string;
  workoutExerciseId: string;
  exerciseId: string;
  exerciseName: string;
  setNumber: number;
  targetSets?: number;
  targetReps?: number;
  weightLbs?: number;
};

export class WatchWorkoutAssistant {
  private state: WatchWorkoutAssistantState;

  constructor(userId: string) {
    this.state = { userId, activeSet: null, updatedAt: new Date().toISOString() };
  }

  getState(): WatchWorkoutAssistantState {
    return this.state;
  }

  loadState(state: WatchWorkoutAssistantState): void {
    this.state = state;
  }

  startSet(input: StartWatchSetInput): WatchWorkoutAssistantState {
    const profile = resolveExerciseProfile(input.exerciseName);
    const activeSet: WatchActiveSetState = {
      workoutSessionId: input.workoutSessionId,
      workoutExerciseId: input.workoutExerciseId,
      exerciseId: input.exerciseId,
      exerciseName: input.exerciseName,
      exerciseProfileId: profile?.id ?? null,
      setNumber: input.setNumber,
      targetSets: input.targetSets ?? profile?.targetSetsDefault ?? 3,
      targetReps: input.targetReps ?? profile?.targetRepsDefault ?? 8,
      currentRepCount: 0,
      motionConfidence: profile?.baselineConfidence ?? 0,
      needsConfirmation: !profile,
      weightLbs: input.weightLbs,
      phase: 'active_set',
    };

    this.state = {
      ...this.state,
      activeSet,
      lastSpokenResponse: profile
        ? `Tracking ${input.exerciseName}. Target ${activeSet.targetReps} reps.`
        : `${input.exerciseName} is not motion-tracked. Use voice or manual entry.`,
      updatedAt: new Date().toISOString(),
    };
    return this.state;
  }

  processMotionBatch(samples: WatchMotionSample[]): RepDetectionResult & { state: WatchWorkoutAssistantState } {
    const set = this.state.activeSet;
    if (!set || set.phase !== 'active_set') {
      return {
        detectedReps: 0,
        confidence: 0,
        supported: false,
        needsConfirmation: true,
        reason: 'No active set',
        state: this.state,
      };
    }

    const profile = set.exerciseProfileId ? resolveExerciseProfile(set.exerciseName) : null;
    if (!profile) {
      return {
        detectedReps: set.currentRepCount,
        confidence: 0,
        supported: false,
        needsConfirmation: true,
        reason: 'Exercise not supported for automatic rep counting.',
        state: this.state,
      };
    }

    const result = detectRepsFromMotion(samples, profile);
    const mergedReps = Math.max(set.currentRepCount, result.detectedReps);

    this.state = {
      ...this.state,
      activeSet: {
        ...set,
        currentRepCount: mergedReps,
        motionConfidence: result.confidence,
        needsConfirmation: result.needsConfirmation,
      },
      updatedAt: new Date().toISOString(),
    };

    return { ...result, state: this.state };
  }

  correctRepCount(repCount: number): WatchWorkoutAssistantState {
    const set = this.state.activeSet;
    if (!set) return this.state;

    this.state = {
      ...this.state,
      activeSet: {
        ...set,
        currentRepCount: repCount,
        needsConfirmation: false,
        motionConfidence: 1,
      },
      lastSpokenResponse: `Rep count set to ${repCount}.`,
      updatedAt: new Date().toISOString(),
    };
    return this.state;
  }

  confirmReps(): WatchWorkoutAssistantState {
    const set = this.state.activeSet;
    if (!set) return this.state;

    this.state = {
      ...this.state,
      activeSet: { ...set, needsConfirmation: false },
      lastSpokenResponse: `Confirmed ${set.currentRepCount} reps.`,
      updatedAt: new Date().toISOString(),
    };
    return this.state;
  }

  handleVoice(
    transcript: string,
    voiceCtx: Omit<WatchVoiceContext, 'activeSet'>,
  ): WatchVoiceCommandResult & { state: WatchWorkoutAssistantState } {
    const parsed = parseWatchVoiceCommand(transcript, {
      activeSet: this.state.activeSet,
      ...voiceCtx,
    });

    if (!parsed) {
      return {
        intent: 'unknown',
        spokenResponse: 'I did not understand. Try "What rep am I on?" or "Correct to rep 8."',
        state: this.state,
      };
    }

    if (parsed.state && this.state.activeSet) {
      this.state = {
        ...this.state,
        activeSet: { ...this.state.activeSet, ...parsed.state },
        lastSpokenResponse: parsed.spokenResponse,
        updatedAt: new Date().toISOString(),
      };
    } else {
      this.state = {
        ...this.state,
        lastSpokenResponse: parsed.spokenResponse,
        updatedAt: new Date().toISOString(),
      };
    }

    return { ...parsed, state: this.state };
  }

  startRest(seconds: number): WatchWorkoutAssistantState {
    const set = this.state.activeSet;
    if (!set) return this.state;

    this.state = {
      ...this.state,
      activeSet: { ...set, phase: 'rest', restSecondsRemaining: seconds },
      lastSpokenResponse: `Rest for ${seconds} seconds.`,
      updatedAt: new Date().toISOString(),
    };
    return this.state;
  }

  tickRest(): WatchWorkoutAssistantState {
    const set = this.state.activeSet;
    if (!set || set.phase !== 'rest' || set.restSecondsRemaining === undefined) return this.state;

    const next = Math.max(0, set.restSecondsRemaining - 1);
    this.state = {
      ...this.state,
      activeSet: {
        ...set,
        restSecondsRemaining: next,
        phase: next === 0 ? 'between_sets' : 'rest',
      },
      updatedAt: new Date().toISOString(),
    };
    return this.state;
  }

  advanceToNextSet(weightLbs?: number): WatchWorkoutAssistantState {
    const set = this.state.activeSet;
    if (!set) return this.state;

    this.state = {
      ...this.state,
      activeSet: {
        ...set,
        setNumber: set.setNumber + 1,
        currentRepCount: 0,
        phase: 'active_set',
        restSecondsRemaining: undefined,
        needsConfirmation: set.exerciseProfileId ? false : true,
        motionConfidence: set.exerciseProfileId ? getConfidenceThreshold() + 0.1 : 0,
        weightLbs: weightLbs ?? set.weightLbs,
      },
      lastSpokenResponse: `Set ${set.setNumber + 1} ready.`,
      updatedAt: new Date().toISOString(),
    };
    return this.state;
  }

  clearSet(): WatchWorkoutAssistantState {
    this.state = { ...this.state, activeSet: null, updatedAt: new Date().toISOString() };
    return this.state;
  }

  static motionSupported(exerciseName: string): boolean {
    return isMotionTrackingSupported(exerciseName);
  }
}
