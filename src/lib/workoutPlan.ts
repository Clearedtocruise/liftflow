import { enrichWithSupersetGroups } from '@/lib/supersetFlow';
import { isConditioningWorkout } from '@/lib/weekPlan';
import { normalizeExecutionMode, prescribeExerciseExecution } from '@/lib/workoutExecutionMode';
import type { WorkoutExercise, WorkoutSession } from '@/types';
import type { PlannedWorkout, TemplateExercise } from '@/types/training';
import type { EditableWorkoutExercise } from '@/types/workoutExecution';
import type { WorkoutExecutionMode } from '@/types/workoutExecutionMode';

function normalizeExerciseName(name: string): string {
  return name.trim().toLowerCase();
}

function fallbackPlanExerciseFromSession(
  sessionEx: WorkoutExercise,
  index: number,
  tabataMode: boolean,
): EditableWorkoutExercise {
  const name = sessionEx.exercise?.name ?? 'Exercise';
  return {
    id: `session-${index}-${normalizeExerciseName(name).replace(/\s+/g, '-')}`,
    exerciseId: sessionEx.exerciseId,
    name,
    sets: tabataMode ? 10 : Math.max(3, sessionEx.sets?.length ?? 3),
    repRange: sessionEx.suggestedReps ?? '8-10',
    restSeconds: tabataMode ? 20 : 90,
    executionMode: tabataMode ? ('tabata' as const) : undefined,
  };
}

function matchTemplateForSessionExercise(
  sessionEx: WorkoutExercise,
  templateExercises: EditableWorkoutExercise[],
  index: number,
): EditableWorkoutExercise | null {
  const sessionName = normalizeExerciseName(sessionEx.exercise?.name ?? '');

  const byIndex = templateExercises[index];
  if (byIndex && normalizeExerciseName(byIndex.name) === sessionName) {
    return byIndex;
  }

  if (sessionEx.exerciseId) {
    const byId = templateExercises.find((item) => item.exerciseId === sessionEx.exerciseId);
    if (byId) return byId;
  }

  const byName = templateExercises.find((item) => normalizeExerciseName(item.name) === sessionName);
  if (byName) return byName;

  return byIndex ?? null;
}

/** Resolve planned workout metadata for an in-progress session. */
export function resolvePlannedWorkoutForSession(
  session: WorkoutSession,
  candidates: PlannedWorkout[],
  draftWorkout: PlannedWorkout | null,
): PlannedWorkout | null {
  if (session.plannedWorkoutId) {
    const fromCandidates = candidates.find((workout) => workout.id === session.plannedWorkoutId);
    if (fromCandidates) return fromCandidates;
  }
  if (draftWorkout?.id === session.plannedWorkoutId) return draftWorkout;
  return draftWorkout;
}

/**
 * Build plan metadata aligned to the live session exercise order.
 * Prevents draft/week-plan refreshes from desyncing sets, supersets, and advance logic.
 */
export function buildPlanExercisesFromSession(
  session: WorkoutSession,
  plannedWorkout: PlannedWorkout | null,
  tabataModeEnabled: boolean,
): EditableWorkoutExercise[] {
  const sessionSorted = [...session.exercises].sort((a, b) => a.sortOrder - b.sortOrder);
  const tabataMode =
    tabataModeEnabled && plannedWorkout != null && !isConditioningWorkout(plannedWorkout);

  const plannedMatchesSession =
    plannedWorkout != null &&
    (!session.plannedWorkoutId || plannedWorkout.id === session.plannedWorkoutId);

  const templatePlan = plannedMatchesSession
    ? exercisesForSessionStart(plannedWorkout, tabataMode)
    : [];

  const orderAligned =
    templatePlan.length === sessionSorted.length &&
    templatePlan.every(
      (template, index) =>
        normalizeExerciseName(template.name) ===
        normalizeExerciseName(sessionSorted[index]?.exercise?.name ?? ''),
    );

  if (orderAligned) {
    return templatePlan;
  }

  const merged = sessionSorted.map((sessionEx, index) => {
    const matched = matchTemplateForSessionExercise(sessionEx, templatePlan, index);
    return matched ?? fallbackPlanExerciseFromSession(sessionEx, index, tabataMode);
  });

  return enrichWithSupersetGroups(
    merged,
    normalizeExecutionMode(plannedWorkout?.metadata?.executionMode),
  );
}

function setsFromPrescription(
  prescription: ReturnType<typeof prescribeExerciseExecution>,
  fallback: number,
): number {
  if (prescription.scheme === 'set_rep' || prescription.scheme === 'superset') return prescription.sets;
  if (prescription.scheme === 'interval') return prescription.rounds;
  if (prescription.scheme === 'circuit') return prescription.rounds;
  return fallback;
}

function restFromPrescription(
  prescription: ReturnType<typeof prescribeExerciseExecution>,
  fallback?: number,
): number | undefined {
  if (prescription.scheme === 'set_rep') return prescription.restSeconds;
  if (prescription.scheme === 'interval') return prescription.restSeconds;
  if (prescription.scheme === 'superset') return prescription.restBetweenRoundSetsSeconds;
  return fallback;
}

function templateToEditable(
  exercise: TemplateExercise,
  index: number,
  defaultMode?: WorkoutExecutionMode,
): EditableWorkoutExercise {
  const name = exercise.exerciseName ?? exercise.name ?? 'Exercise';
  const executionMode = normalizeExecutionMode(exercise.executionMode ?? defaultMode ?? 'traditional');
  const prescription = prescribeExerciseExecution({
    name,
    mode: executionMode,
    sets: exercise.sets,
    repRange: exercise.repRange ?? exercise.reps,
    restSeconds: exercise.restSeconds,
  });

  return {
    id: `plan-${index}-${name.toLowerCase().replace(/\s+/g, '-')}`,
    exerciseId: exercise.exerciseId,
    name,
    sets: setsFromPrescription(prescription, exercise.sets ?? 3),
    repRange:
      prescription.scheme === 'set_rep' || prescription.scheme === 'circuit' || prescription.scheme === 'superset'
        ? prescription.repRange
        : exercise.repRange ?? exercise.reps,
    restSeconds: restFromPrescription(prescription, exercise.restSeconds),
    weightLbs: exercise.weightLbs,
    executionMode,
    supersetGroupId: exercise.supersetGroupId,
  };
}

export function exercisesFromPlannedWorkout(workout: PlannedWorkout | null): EditableWorkoutExercise[] {
  const raw = workout?.metadata?.exercises ?? [];
  const defaultMode = normalizeExecutionMode(workout?.metadata?.executionMode);
  return enrichWithSupersetGroups(
    raw.map((exercise, index) => templateToEditable(exercise, index, defaultMode)),
    defaultMode,
  );
}

/** Session-only timing remap — preserves exercise identity (name, id, weight). */
export function remapExercisesForExecutionMode(
  exercises: EditableWorkoutExercise[],
  mode: WorkoutExecutionMode,
): EditableWorkoutExercise[] {
  return exercises.map((exercise, index) => {
    const prescription = prescribeExerciseExecution({
      name: exercise.name,
      mode,
      sets: exercise.sets,
      repRange: exercise.repRange,
      restSeconds: exercise.restSeconds,
    });
    return {
      ...exercise,
      id: exercise.id || `plan-${index}-${exercise.name.toLowerCase().replace(/\s+/g, '-')}`,
      executionMode: mode,
      sets: setsFromPrescription(prescription, exercise.sets),
      repRange:
        prescription.scheme === 'set_rep' || prescription.scheme === 'circuit' || prescription.scheme === 'superset'
          ? prescription.repRange
          : exercise.repRange,
      restSeconds: restFromPrescription(prescription, exercise.restSeconds),
    };
  });
}

export function exercisesForSessionStart(
  workout: PlannedWorkout | null,
  tabataModeEnabled: boolean,
): EditableWorkoutExercise[] {
  const base = exercisesFromPlannedWorkout(workout);
  if (!tabataModeEnabled) return base;
  return remapExercisesForExecutionMode(base, 'tabata');
}

export function estimateWorkoutDurationMinutes(exercises: EditableWorkoutExercise[]): number {
  if (exercises.length === 0) return 60;
  const minutes = exercises.reduce((total, exercise) => {
    const restMinutes = ((exercise.restSeconds ?? 90) / 60) * Math.max(exercise.sets - 1, 0);
    return total + Math.max(exercise.sets * 2, 6) + restMinutes;
  }, 0);
  return Math.max(45, Math.min(75, Math.round(minutes)));
}

export function parseTargetReps(repRange?: string): number {
  if (!repRange) return 8;
  const match = repRange.match(/\d+/);
  return match ? parseInt(match[0], 10) : 8;
}

export function editableExercisesToTemplate(
  exercises: EditableWorkoutExercise[],
): import('@/types/training').TemplateExercise[] {
  return exercises.map((exercise) => ({
    exerciseId: exercise.exerciseId,
    exerciseName: exercise.name,
    name: exercise.name,
    sets: exercise.sets,
    repRange: exercise.repRange,
    restSeconds: exercise.restSeconds,
    weightLbs: exercise.weightLbs,
    executionMode: exercise.executionMode,
    supersetGroupId: exercise.supersetGroupId,
  }));
}
