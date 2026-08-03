/**
 * Turns a planned workout into a readable exercise list for the home screen preview.
 *
 * The hero card only ever showed the first four exercises with "+N more", so the rest of the
 * session was invisible without starting the workout. Tapping the heading opens the full list, and
 * each line has to describe the work the way it will actually be performed — interval rounds are
 * not sets, and a superset has to read as one station rather than two unrelated lifts.
 */

import type { EditableWorkoutExercise } from '@/types/workoutExecution';

export type WorkoutPreviewRow = {
  id: string;
  position: number;
  name: string;
  /** "3 sets × 8-10 · 90s rest" — how the work is prescribed. */
  detail: string;
  /**
   * Station label for paired work, in the standard `A1` / `A2` notation used on the workout and
   * active session screens. A bare letter and a full stop read like an outline heading rather than
   * a programme, so the position is always included and the label never prefixes the name.
   */
  supersetLabel?: string;
};

export type WorkoutPreview = {
  rows: WorkoutPreviewRow[];
  exerciseCount: number;
  /** Total working sets, used for the "12 exercises · 38 sets" summary line. */
  totalSets: number;
};

/** Lifters say "90s rest", not "1m 30s", so seconds are kept until two minutes. */
function formatSeconds(seconds: number): string {
  if (seconds < 120) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
}

export function describePlannedExercise(exercise: EditableWorkoutExercise): string {
  const parts: string[] = [];
  const mode = exercise.executionMode;

  // Interval work is measured in rounds of work and rest, so reporting "sets" would misdescribe it.
  const intervalMode = mode === 'tabata' || mode === 'hiit' || mode === 'circuit';
  if (intervalMode && exercise.intervalRounds) {
    parts.push(`${exercise.intervalRounds} rounds`);
    if (exercise.intervalWorkSeconds) {
      const work = formatSeconds(exercise.intervalWorkSeconds);
      parts.push(
        exercise.intervalRestSeconds
          ? `${work} work / ${formatSeconds(exercise.intervalRestSeconds)} rest`
          : `${work} work`,
      );
    }
  } else {
    const sets = exercise.sets > 0 ? exercise.sets : 1;
    parts.push(`${sets} ${sets === 1 ? 'set' : 'sets'}`);
    if (exercise.repRange) parts.push(`× ${exercise.repRange}`);
    if (exercise.restSeconds) parts.push(`${formatSeconds(exercise.restSeconds)} rest`);
  }

  if (exercise.weightLbs && exercise.weightLbs > 0) {
    parts.push(`${Math.round(exercise.weightLbs)} lb`);
  }

  // The rep range reads as part of the set count, so it joins without a separator dot.
  return parts
    .join(' · ')
    .replace(/ · × /g, ' × ');
}

export function buildWorkoutPreview(exercises: EditableWorkoutExercise[]): WorkoutPreview {
  const groupLetters = new Map<string, string>();
  let nextLetter = 0;

  for (const exercise of exercises) {
    const groupId = exercise.supersetGroupId;
    if (!groupId) continue;
    const paired = exercises.filter((other) => other.supersetGroupId === groupId).length > 1;
    if (paired && !groupLetters.has(groupId)) {
      groupLetters.set(groupId, String.fromCharCode(65 + nextLetter));
      nextLetter += 1;
    }
  }

  const positionInGroup = new Map<string, number>();

  const rows = exercises.map((exercise, index) => {
    const groupId = exercise.supersetGroupId;
    const letter = groupId ? groupLetters.get(groupId) : undefined;

    let supersetLabel: string | undefined;
    if (groupId && letter) {
      const next = (positionInGroup.get(groupId) ?? 0) + 1;
      positionInGroup.set(groupId, next);
      supersetLabel = `${letter}${next}`;
    }

    return {
      id: exercise.id || `${exercise.name}-${index}`,
      position: index + 1,
      name: exercise.name,
      detail: describePlannedExercise(exercise),
      supersetLabel,
    };
  });

  return {
    rows,
    exerciseCount: exercises.length,
    totalSets: exercises.reduce((sum, exercise) => {
      const rounds = exercise.intervalRounds ?? 0;
      const sets = exercise.sets > 0 ? exercise.sets : 0;
      return sum + (rounds > 0 ? rounds : sets);
    }, 0),
  };
}

/** "12 exercises · 38 sets" */
export function summarizeWorkoutPreview(preview: WorkoutPreview): string {
  const exercises = `${preview.exerciseCount} ${preview.exerciseCount === 1 ? 'exercise' : 'exercises'}`;
  if (preview.totalSets <= 0) return exercises;
  return `${exercises} · ${preview.totalSets} sets`;
}
