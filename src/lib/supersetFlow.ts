import type { WorkoutExercise } from '@/types/workout';
import type { EditableWorkoutExercise } from '@/types/workoutExecution';

export type SupersetGroup = {
  id: string;
  memberIndices: number[];
};

export type PostSetSupersetAction = {
  skipRest: boolean;
  immediateAdvanceIndex: number | null;
  afterRestAdvanceIndex: number | null;
};

/** Pair accessories (indices 1–2, 3–4, …) when no explicit groups exist. Index 0 stays standalone. */
export function enrichWithSupersetGroups(exercises: EditableWorkoutExercise[]): EditableWorkoutExercise[] {
  if (exercises.some((e) => e.supersetGroupId)) return exercises;
  if (exercises.length < 3) return exercises;

  const result = exercises.map((e) => ({ ...e }));
  for (let i = 1; i < result.length; i += 2) {
    if (i + 1 >= result.length) break;
    const groupId = `ss-${Math.floor(i / 2) + 1}`;
    result[i] = { ...result[i], supersetGroupId: groupId };
    result[i + 1] = { ...result[i + 1], supersetGroupId: groupId };
  }
  return result;
}

export function buildSupersetGroups(planExercises: EditableWorkoutExercise[]): SupersetGroup[] {
  const byId = new Map<string, number[]>();
  planExercises.forEach((exercise, index) => {
    if (!exercise.supersetGroupId) return;
    const list = byId.get(exercise.supersetGroupId) ?? [];
    list.push(index);
    byId.set(exercise.supersetGroupId, list);
  });

  return [...byId.entries()]
    .filter(([, indices]) => indices.length >= 2)
    .map(([id, memberIndices]) => ({
      id,
      memberIndices: [...memberIndices].sort((a, b) => a - b),
    }));
}

export function getSupersetGroupForIndex(
  index: number,
  planExercises: EditableWorkoutExercise[],
): SupersetGroup | null {
  const groupId = planExercises[index]?.supersetGroupId;
  if (!groupId) return null;
  const groups = buildSupersetGroups(planExercises);
  return groups.find((group) => group.id === groupId) ?? null;
}

export function getSupersetLabel(group: SupersetGroup | null, index: number): string | null {
  if (!group || group.memberIndices.length < 2) return null;
  const position = group.memberIndices.indexOf(index);
  if (position < 0) return null;
  return `${String.fromCharCode(65 + position)}`;
}

export function targetSetsForIndex(index: number, planExercises: EditableWorkoutExercise[]): number {
  return planExercises[index]?.sets ?? 3;
}

export function isSupersetGroupComplete(
  group: SupersetGroup,
  sessionExercises: WorkoutExercise[],
  planExercises: EditableWorkoutExercise[],
): boolean {
  return group.memberIndices.every((index) => {
    const exercise = sessionExercises[index];
    const target = targetSetsForIndex(index, planExercises);
    return (exercise?.sets?.length ?? 0) >= target;
  });
}

export function resolvePostSetSupersetAction(
  currentIndex: number,
  planExercises: EditableWorkoutExercise[],
  sessionExercises: WorkoutExercise[],
  /** When resolving before rest starts, pass completed + 1 for the set just logged. */
  setsJustLoggedOverride?: number,
): PostSetSupersetAction {
  const group = getSupersetGroupForIndex(currentIndex, planExercises);
  if (!group || group.memberIndices.length < 2) {
    return { skipRest: false, immediateAdvanceIndex: null, afterRestAdvanceIndex: null };
  }

  const setsJustLogged =
    setsJustLoggedOverride ?? sessionExercises[currentIndex]?.sets?.length ?? 0;
  const ordered = [...group.memberIndices].sort((a, b) => a - b);
  const currentPos = ordered.indexOf(currentIndex);

  for (let offset = 1; offset < ordered.length; offset += 1) {
    const partnerIndex = ordered[(currentPos + offset) % ordered.length];
    const partnerSets = sessionExercises[partnerIndex]?.sets?.length ?? 0;
    if (partnerSets < setsJustLogged) {
      return {
        skipRest: true,
        immediateAdvanceIndex: partnerIndex,
        afterRestAdvanceIndex: null,
      };
    }
  }

  const firstIndex = ordered[0];
  const firstSets = sessionExercises[firstIndex]?.sets?.length ?? 0;
  const target = targetSetsForIndex(firstIndex, planExercises);
  if (firstSets < target) {
    return {
      skipRest: false,
      immediateAdvanceIndex: null,
      afterRestAdvanceIndex: firstIndex,
    };
  }

  return { skipRest: false, immediateAdvanceIndex: null, afterRestAdvanceIndex: null };
}

export function nextExerciseIndexAfterGroup(
  group: SupersetGroup,
  totalExercises: number,
): number | null {
  const lastInGroup = Math.max(...group.memberIndices);
  const next = lastInGroup + 1;
  return next < totalExercises ? next : null;
}
