/**
 * Lets the Apple Watch delegate set logging and rest control to the phone workout UI
 * when ActiveWorkoutScreen is open — phone stays the single source of truth.
 */

type LogSetResult = { ok: true } | { ok: false; error: string };

export type WatchDisplayContext = {
  stationLabel?: string;
  statusLine?: string;
  supersetHint?: string;
  draftReps?: number;
  /** Phone rest overlay labels (keeps Watch/global rest in sync with supersets). */
  restCurrentLabel?: string;
  restUpNextLabel?: string;
  restExerciseName?: string;
};

const LB_PER_KG = 2.2046226218;

let logSetHandler: (() => Promise<void>) | null = null;
let skipRestHandler: (() => Promise<void>) | null = null;
let cancelWorkoutHandler: (() => Promise<void>) | null = null;
let endWorkoutHandler: (() => Promise<void>) | null = null;
let setRepsHandler: ((reps: number) => void) | null = null;
let setWeightKgHandler: ((weightKg: number) => void) | null = null;
let pendingWatchReps: number | null = null;
let pendingWatchWeightKg: number | null = null;
let readExerciseIndex: (() => number) | null = null;
let readRestSeconds: (() => number | null) | null = null;
let readTargetSets: (() => number) | null = null;
let displayContext: WatchDisplayContext | null = null;
let executionRestOverride: number | null = null;
let lastWatchActiveCalories: number | null = null;

export const watchPhoneBridge = {
  setLastWatchActiveCalories(calories: number | null) {
    lastWatchActiveCalories =
      calories != null && Number.isFinite(calories) && calories > 0 ? Math.round(calories) : null;
  },

  getLastWatchActiveCalories(): number | null {
    return lastWatchActiveCalories;
  },

  setLogSetHandler(handler: (() => Promise<void>) | null) {
    logSetHandler = handler;
  },

  setRepsHandler(handler: ((reps: number) => void) | null) {
    setRepsHandler = handler;
    if (handler && pendingWatchReps != null) {
      handler(pendingWatchReps);
    }
  },

  setWeightKgHandler(handler: ((weightKg: number) => void) | null) {
    setWeightKgHandler = handler;
    if (handler && pendingWatchWeightKg != null) {
      handler(pendingWatchWeightKg);
    }
  },

  getPendingWatchReps(): number | null {
    return pendingWatchReps;
  },

  clearPendingWatchReps(): void {
    pendingWatchReps = null;
  },

  getPendingWatchWeightKg(): number | null {
    return pendingWatchWeightKg;
  },

  clearPendingWatchWeightKg(): void {
    pendingWatchWeightKg = null;
  },

  setSessionHandlers(handlers: {
    skipRest: () => Promise<void>;
    cancelWorkout?: () => Promise<void>;
    endWorkout?: () => Promise<void>;
    getExerciseIndex: () => number;
    getRestSecondsRemaining: () => number | null;
  } | null) {
    if (!handlers) {
      skipRestHandler = null;
      cancelWorkoutHandler = null;
      endWorkoutHandler = null;
      readExerciseIndex = null;
      readRestSeconds = null;
      executionRestOverride = null;
      return;
    }
    skipRestHandler = handlers.skipRest;
    cancelWorkoutHandler = handlers.cancelWorkout ?? null;
    endWorkoutHandler = handlers.endWorkout ?? null;
    readExerciseIndex = handlers.getExerciseIndex;
    readRestSeconds = handlers.getRestSecondsRemaining;
  },

  setTargetSetsReader(reader: (() => number) | null) {
    readTargetSets = reader;
  },

  setDisplayContext(context: WatchDisplayContext | null) {
    displayContext = context;
  },

  getDisplayContext(): WatchDisplayContext | null {
    return displayContext;
  },

  /** Tabata/circuit rest — takes priority over session traditional rest on Watch. */
  setExecutionRestOverride(seconds: number | null) {
    executionRestOverride = seconds;
  },

  getTargetSets(): number {
    return readTargetSets?.() ?? 3;
  },

  getExerciseIndex(): number {
    return readExerciseIndex?.() ?? 0;
  },

  getRestSecondsRemaining(): number | null {
    if (executionRestOverride != null && executionRestOverride > 0) {
      return executionRestOverride;
    }
    return readRestSeconds?.() ?? null;
  },

  getEffectiveRestSecondsRemaining(): number | null {
    return this.getRestSecondsRemaining();
  },

  applyReps(reps: number): boolean {
    pendingWatchReps = reps;
    if (!setRepsHandler) return false;
    setRepsHandler(reps);
    return true;
  },

  applyWeightLbs(weightLbs: number): boolean {
    const weightKg = weightLbs / LB_PER_KG;
    pendingWatchWeightKg = weightKg;
    if (!setWeightKgHandler) return false;
    setWeightKgHandler(weightKg);
    return true;
  },

  async logCurrentSet(): Promise<LogSetResult> {
    if (!logSetHandler) {
      return { ok: false, error: 'Open your workout on iPhone to log sets.' };
    }
    try {
      await logSetHandler();
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Could not log set on iPhone.',
      };
    }
  },

  async skipRest(): Promise<void> {
    if (skipRestHandler) {
      await skipRestHandler();
    }
  },

  async cancelWorkout(): Promise<LogSetResult> {
    if (!cancelWorkoutHandler) {
      return { ok: false, error: 'Open ONE MORE on iPhone to cancel the workout.' };
    }
    try {
      await cancelWorkoutHandler();
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Could not cancel workout.',
      };
    }
  },

  async endWorkout(): Promise<LogSetResult> {
    if (!endWorkoutHandler) {
      return cancelWorkoutHandler
        ? this.cancelWorkout()
        : { ok: false, error: 'Open ONE MORE on iPhone to end the workout.' };
    }
    try {
      await endWorkoutHandler();
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Could not end workout.',
      };
    }
  },
};
