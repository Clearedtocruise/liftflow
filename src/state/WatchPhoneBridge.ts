/**
 * Lets the Apple Watch delegate set logging and rest control to the phone — the phone stays the
 * single source of truth.
 *
 * ActiveWorkoutScreen registers the rich handler (supersets, rest flow, progression) while it is
 * open. A session-level fallback covers every other screen, because a wrist tap that only worked
 * when the phone was already showing the workout defeated the point of logging from the watch.
 */

type LogSetResult = { ok: true } | { ok: false; error: string };

export type WatchDisplayContext = {
  stationLabel?: string;
  statusLine?: string;
  supersetHint?: string;
  draftReps?: number;
};

const LB_PER_KG = 2.2046226218;

let logSetHandler: (() => Promise<LogSetResult>) | null = null;
let fallbackLogSetHandler: (() => Promise<LogSetResult>) | null = null;
let skipRestHandler: (() => Promise<void>) | null = null;
let cancelWorkoutHandler: (() => Promise<void>) | null = null;
let setRepsHandler: ((reps: number) => void) | null = null;
let setWeightKgHandler: ((weightKg: number) => void) | null = null;
let pendingWatchReps: number | null = null;
let pendingWatchWeightKg: number | null = null;
let readExerciseIndex: (() => number) | null = null;
let readRestSeconds: (() => number | null) | null = null;
let readTargetSets: (() => number) | null = null;
let displayContext: WatchDisplayContext | null = null;

export const watchPhoneBridge = {
  setLogSetHandler(handler: (() => Promise<LogSetResult>) | null) {
    logSetHandler = handler;
  },

  /** Used whenever the workout screen is not mounted. Registered for the whole app session. */
  setFallbackLogSetHandler(handler: (() => Promise<LogSetResult>) | null) {
    fallbackLogSetHandler = handler;
  },

  /** True when a wrist tap can log a set right now — with or without the workout screen open. */
  canLogSet(): boolean {
    return logSetHandler != null || fallbackLogSetHandler != null;
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
    getExerciseIndex: () => number;
    getRestSecondsRemaining: () => number | null;
  } | null) {
    if (!handlers) {
      skipRestHandler = null;
      cancelWorkoutHandler = null;
      readExerciseIndex = null;
      readRestSeconds = null;
      return;
    }
    skipRestHandler = handlers.skipRest;
    cancelWorkoutHandler = handlers.cancelWorkout ?? null;
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

  getTargetSets(): number {
    return readTargetSets?.() ?? 3;
  },

  getExerciseIndex(): number {
    return readExerciseIndex?.() ?? 0;
  },

  getRestSecondsRemaining(): number | null {
    return readRestSeconds?.() ?? null;
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
    const handler = logSetHandler ?? fallbackLogSetHandler;
    if (!handler) {
      return { ok: false, error: 'Start a workout on iPhone to log sets.' };
    }
    try {
      return await handler();
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
};
