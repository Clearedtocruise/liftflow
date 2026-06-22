export type WorkoutVoiceIntent =
  | 'LOG_SET'
  | 'LOG_BODYWEIGHT_SET'
  | 'ADD_EXERCISE'
  | 'REPLACE_EXERCISE'
  | 'NEXT_EXERCISE'
  | 'PREVIOUS_EXERCISE'
  | 'START_REST_TIMER'
  | 'FINISH_WORKOUT'
  | 'ASK_STATUS'
  | 'CANCEL'
  | 'UNKNOWN';

export type ParsedWorkoutCommand = {
  intent: WorkoutVoiceIntent;
  exerciseName?: string;
  replacementExerciseName?: string;
  weight?: number;
  reps?: number;
  durationSeconds?: number;
  unit?: 'lb' | 'kg' | 'bodyweight';
  rawText: string;
  confidence: number;
};

export type VoiceWorkoutState = {
  wakeWordEnabled: boolean;
  listeningForWakeWord: boolean;
  listeningForCommand: boolean;
  transcript: string;
  lastCommand?: ParsedWorkoutCommand;
  error?: string;
};

export type VoiceWorkoutHandlers = {
  logSet: (input: {
    exerciseName?: string;
    weight?: number;
    weightUnit?: 'lb' | 'kg';
    reps: number;
    bodyweight?: boolean;
  }) => Promise<{ ok: boolean; message: string; shouldStartRestTimer?: boolean }>;
  nextExercise: () => Promise<{ ok: boolean; message: string }>;
  previousExercise: () => Promise<{ ok: boolean; message: string }>;
  startRestTimer: (durationSeconds: number) => Promise<{ ok: boolean; message: string }>;
  finishWorkout: () => Promise<{ ok: boolean; message: string }>;
  askStatus: () => Promise<{ ok: boolean; message: string }>;
  replaceExercise: (
    fromName: string,
    toName: string,
  ) => Promise<{ ok: boolean; message: string }>;
};

export type ExecuteWorkoutVoiceCommandInput = {
  command: ParsedWorkoutCommand;
  handlers: VoiceWorkoutHandlers;
};

export type ExecuteWorkoutVoiceCommandResult = {
  success: boolean;
  message: string;
  shouldStartRestTimer?: boolean;
};
