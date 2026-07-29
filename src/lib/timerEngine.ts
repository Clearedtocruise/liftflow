import {
  CIRCUIT_MODE_DEFAULTS,
  INTERVAL_MODE_DEFAULTS,
  SET_REP_MODE_DEFAULTS,
} from '@/constants/workoutExecutionModes';
import { DEFAULT_REST_SECONDS } from '@/constants/workout';
import type { WorkoutExecutionMode } from '@/types/workoutExecutionMode';

export type TimerKind = 'traditional_rest' | 'interval' | 'circuit_transition';

export type IntervalPhase = 'work' | 'rest' | 'done';

export type CircuitPhase = 'transition' | 'round_rest' | 'done';

export type IntervalTimerConfig = {
  workSeconds: number;
  restSeconds: number;
  rounds: number;
};

export type CircuitTimerConfig = {
  restBetweenExercisesSeconds: number;
  restBetweenRoundsSeconds: number;
  rounds: number;
};

export type TraditionalTimerConfig = {
  restSeconds: number;
};

export const TRADITIONAL_REST_PRESETS = [60, 90, 120, 150, 180] as const;

export type IntervalTimerState = {
  kind: 'interval';
  phase: IntervalPhase;
  round: number;
  secondsRemaining: number;
  running: boolean;
  config: IntervalTimerConfig;
};

export type CircuitTimerState = {
  kind: 'circuit_transition';
  phase: CircuitPhase;
  round: number;
  secondsRemaining: number;
  running: boolean;
  config: CircuitTimerConfig;
};

export function formatTimerSeconds(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function resolveTraditionalRestSeconds(
  mode: WorkoutExecutionMode = 'traditional',
  override?: number,
): number {
  if (override != null && override > 0) return override;
  if (mode === 'hypertrophy') return SET_REP_MODE_DEFAULTS.hypertrophy.restSeconds;
  if (mode === 'strength') return SET_REP_MODE_DEFAULTS.strength.restSeconds;
  return SET_REP_MODE_DEFAULTS.traditional.restSeconds ?? DEFAULT_REST_SECONDS;
}

export function resolveIntervalConfig(
  mode: 'hiit' | 'tabata',
  overrides?: Partial<IntervalTimerConfig>,
): IntervalTimerConfig {
  const defaults = INTERVAL_MODE_DEFAULTS[mode];
  return {
    workSeconds: overrides?.workSeconds ?? defaults.workSeconds,
    restSeconds: overrides?.restSeconds ?? defaults.restSeconds,
    rounds: overrides?.rounds ?? defaults.rounds,
  };
}

export function resolveCircuitConfig(overrides?: Partial<CircuitTimerConfig>): CircuitTimerConfig {
  return {
    restBetweenExercisesSeconds:
      overrides?.restBetweenExercisesSeconds ?? CIRCUIT_MODE_DEFAULTS.restBetweenExercisesSeconds,
    restBetweenRoundsSeconds:
      overrides?.restBetweenRoundsSeconds ?? CIRCUIT_MODE_DEFAULTS.restBetweenRoundsSeconds,
    rounds: overrides?.rounds ?? CIRCUIT_MODE_DEFAULTS.rounds,
  };
}

export function createIntervalTimerState(
  mode: 'hiit' | 'tabata',
  overrides?: Partial<IntervalTimerConfig>,
): IntervalTimerState {
  const config = resolveIntervalConfig(mode, overrides);
  return {
    kind: 'interval',
    phase: 'work',
    round: 1,
    secondsRemaining: config.workSeconds,
    running: false,
    config,
  };
}

export function createCircuitTimerState(
  phase: Exclude<CircuitPhase, 'done'>,
  overrides?: Partial<CircuitTimerConfig>,
  round = 1,
): CircuitTimerState {
  const config = resolveCircuitConfig(overrides);
  const secondsRemaining =
    phase === 'round_rest' ? config.restBetweenRoundsSeconds : config.restBetweenExercisesSeconds;
  return {
    kind: 'circuit_transition',
    phase,
    round,
    secondsRemaining,
    running: true,
    config,
  };
}

export function intervalPhaseLabel(phase: IntervalPhase): string {
  if (phase === 'work') return 'Work';
  if (phase === 'rest') return 'Rest';
  return 'Complete';
}

export function circuitPhaseLabel(phase: CircuitPhase): string {
  if (phase === 'transition') return 'Next exercise';
  if (phase === 'round_rest') return 'Round rest';
  return 'Complete';
}

export function skipIntervalRound(state: IntervalTimerState): IntervalTimerState {
  if (state.phase === 'done') return state;
  const { config } = state;

  if (state.round >= config.rounds) {
    return {
      ...state,
      phase: 'done',
      running: false,
      secondsRemaining: 0,
    };
  }

  return {
    ...state,
    phase: 'work',
    round: state.round + 1,
    secondsRemaining: config.workSeconds,
  };
}

/** Phase transition only — the caller owns how much time has elapsed. */
export function advanceIntervalPhase(state: IntervalTimerState): IntervalTimerState {
  const { config } = state;

  if (state.phase === 'work') {
    return { ...state, phase: 'rest', secondsRemaining: config.restSeconds };
  }

  if (state.round >= config.rounds) {
    return { ...state, phase: 'done', running: false, secondsRemaining: 0 };
  }

  return { ...state, phase: 'work', round: state.round + 1, secondsRemaining: config.workSeconds };
}

/** Advance interval timer after a second elapses. */
export function tickIntervalTimer(state: IntervalTimerState): IntervalTimerState {
  if (!state.running || state.phase === 'done') return state;

  if (state.secondsRemaining > 1) {
    return { ...state, secondsRemaining: state.secondsRemaining - 1 };
  }

  return advanceIntervalPhase(state);
}

/**
 * Re-derive the timer from wall-clock time. JS timers stop firing while the app is backgrounded,
 * so a whole Tabata block can elapse unobserved — stepping one phase per tick would be wrong.
 * `deadlineMs` is when the current phase expires; the returned deadline anchors the new phase.
 */
export function advanceIntervalTimerToNow(
  state: IntervalTimerState,
  deadlineMs: number,
  now: number,
): { state: IntervalTimerState; deadlineMs: number } {
  if (!state.running || state.phase === 'done') return { state, deadlineMs };

  let current = state;
  let deadline = deadlineMs;
  const maxPhases = Math.max(state.config.rounds, 1) * 2 + 2;

  for (let step = 0; now >= deadline && current.phase !== 'done' && step < maxPhases; step += 1) {
    current = advanceIntervalPhase(current);
    if (current.phase === 'done') break;
    deadline += current.secondsRemaining * 1000;
  }

  const secondsRemaining =
    current.phase === 'done' ? 0 : Math.max(0, Math.ceil((deadline - now) / 1000));
  return { state: { ...current, secondsRemaining }, deadlineMs: deadline };
}

export function tickCircuitTimer(state: CircuitTimerState): CircuitTimerState {
  if (!state.running || state.phase === 'done') return state;

  if (state.secondsRemaining > 1) {
    return { ...state, secondsRemaining: state.secondsRemaining - 1 };
  }

  return {
    ...state,
    phase: 'done',
    running: false,
    secondsRemaining: 0,
  };
}

export function advanceCircuitTimerToNow(
  state: CircuitTimerState,
  deadlineMs: number,
  now: number,
): CircuitTimerState {
  if (!state.running || state.phase === 'done') return state;
  if (now >= deadlineMs) return { ...state, phase: 'done', running: false, secondsRemaining: 0 };
  return { ...state, secondsRemaining: Math.max(0, Math.ceil((deadlineMs - now) / 1000)) };
}

export function executionModeUsesIntervalTimer(mode: WorkoutExecutionMode): mode is 'hiit' | 'tabata' {
  return mode === 'hiit' || mode === 'tabata';
}

export function executionModeUsesCircuitTimer(mode: WorkoutExecutionMode): boolean {
  return mode === 'circuit';
}

export function executionModeUsesTraditionalRest(mode: WorkoutExecutionMode): boolean {
  return (
    mode === 'traditional' ||
    mode === 'hypertrophy' ||
    mode === 'strength' ||
    mode === 'superset'
  );
}

/** Soft ceiling so a rounds stepper cannot keep a Tabata/HIIT block going forever. */
export const INTERVAL_ROUNDS_MAX = 12;

export function clampIntervalRounds(rounds: number): number {
  return Math.min(INTERVAL_ROUNDS_MAX, Math.max(1, Math.round(rounds)));
}
