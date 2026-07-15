import { CIRCUIT_MODE_DEFAULTS, SUPERSET_MODE_DEFAULTS } from '@/constants/workoutExecutionModes';
import type { WorkoutPositionLabels } from '@/lib/workoutUpNext';
import { resolveWorkoutUpNext } from '@/lib/workoutUpNext';
import type { WorkoutExercise } from '@/types/workout';
import type { EditableWorkoutExercise } from '@/types/workoutExecution';
import type { WorkoutExecutionMode } from '@/types/workoutExecutionMode';

export type SupersetGroup = {
  id: string;
  memberIndices: number[];
};

export type PostSetSupersetAction = {
  skipRest: boolean;
  immediateAdvanceIndex: number | null;
  afterRestAdvanceIndex: number | null;
};

export type CircuitTimerAction = {
  phase: 'transition' | 'round_rest';
  seconds: number;
  round: number;
  advanceIndex: number;
};

export type PostSetFlowAction = PostSetSupersetAction & {
  circuitTimer: CircuitTimerAction | null;
};

export type CircuitStation = {
  /** First exercise index for this station (entry point). */
  entryIndex: number;
  memberIndices: number[];
};

/**
 * Pair consecutive exercises (0–1, 2–3, …) when no explicit groups exist.
 * Only invents pairs for superset/circuit modes — never forces supersets onto traditional plans.
 */
export function enrichWithSupersetGroups(
  exercises: EditableWorkoutExercise[],
  preferredMode?: WorkoutExecutionMode,
): EditableWorkoutExercise[] {
  if (exercises.some((e) => e.supersetGroupId)) return exercises;
  if (exercises.length < 2) return exercises;
  if (
    preferredMode != null &&
    preferredMode !== 'superset' &&
    preferredMode !== 'circuit'
  ) {
    return exercises;
  }

  const result = exercises.map((e) => ({ ...e }));
  for (let i = 0; i + 1 < result.length; i += 2) {
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

/** True while partners have uneven set counts (mid-round A↔B hop). */
export function isSupersetMidRound(
  currentIndex: number,
  planExercises: EditableWorkoutExercise[],
  sessionExercises: WorkoutExercise[],
): boolean {
  const group = getSupersetGroupForIndex(currentIndex, planExercises);
  if (!group || group.memberIndices.length < 2) return false;
  const counts = group.memberIndices.map((index) => sessionExercises[index]?.sets?.length ?? 0);
  return Math.max(...counts) > Math.min(...counts);
}

/**
 * Prev/Next within a superset group only. Returns null at group edges or when not in a group
 * (caller should use linear navigation outside groups).
 */
export function resolveSupersetGroupNavIndex(
  currentIndex: number,
  planExercises: EditableWorkoutExercise[],
  direction: -1 | 1,
): number | null {
  const group = getSupersetGroupForIndex(currentIndex, planExercises);
  if (!group || group.memberIndices.length < 2) return null;
  const ordered = [...group.memberIndices].sort((a, b) => a - b);
  const position = ordered.indexOf(currentIndex);
  if (position < 0) return null;
  const nextPos = position + direction;
  if (nextPos < 0 || nextPos >= ordered.length) return null;
  return ordered[nextPos] ?? null;
}

export function formatSupersetNavChrome(
  currentIndex: number,
  planExercises: EditableWorkoutExercise[],
  sessionExercises: WorkoutExercise[],
): string | null {
  const group = getSupersetGroupForIndex(currentIndex, planExercises);
  if (!group || group.memberIndices.length < 2) return null;
  const letter = getSupersetLabel(group, currentIndex);
  const target = targetSetsForIndex(currentIndex, planExercises);
  const counts = group.memberIndices.map((index) => sessionExercises[index]?.sets?.length ?? 0);
  const activeRound = Math.min(Math.max(...counts, 0) + (isSupersetMidRound(currentIndex, planExercises, sessionExercises) ? 0 : 1), target);
  const round = Math.max(1, Math.min(activeRound, target));
  return letter ? `${letter} · Round ${round}/${target}` : `Round ${round}/${target}`;
}

/** A1, A2, B1, … based on superset group id and position within group. */
export function formatSupersetStationLabel(
  supersetGroupId: string | undefined,
  positionInGroup: number,
): string | null {
  if (!supersetGroupId || positionInGroup < 0) return null;
  const groupNum = Number(supersetGroupId.replace('ss-', ''));
  if (!Number.isFinite(groupNum) || groupNum < 1) return null;
  const letter = String.fromCharCode(64 + groupNum);
  return `${letter}${positionInGroup + 1}`;
}

export function formatExerciseStationLabel(
  exercise: EditableWorkoutExercise | undefined,
  index: number,
  planExercises: EditableWorkoutExercise[],
): string | null {
  if (!exercise?.supersetGroupId) return null;
  const group = getSupersetGroupForIndex(index, planExercises);
  if (!group) return null;
  const position = group.memberIndices.indexOf(index);
  return formatSupersetStationLabel(exercise.supersetGroupId, position);
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

/** Circuit stations: superset groups are one station; ungrouped exercises are solo stations. */
export function buildCircuitStations(planExercises: EditableWorkoutExercise[]): CircuitStation[] {
  const stations: CircuitStation[] = [];
  const seenGroups = new Set<string>();

  planExercises.forEach((exercise, index) => {
    if (exercise.supersetGroupId) {
      if (seenGroups.has(exercise.supersetGroupId)) return;
      seenGroups.add(exercise.supersetGroupId);
      const group = getSupersetGroupForIndex(index, planExercises);
      if (group) {
        stations.push({ entryIndex: group.memberIndices[0], memberIndices: group.memberIndices });
        return;
      }
    }
    stations.push({ entryIndex: index, memberIndices: [index] });
  });

  return stations;
}

export function circuitStationForIndex(
  index: number,
  planExercises: EditableWorkoutExercise[],
): CircuitStation | null {
  const stations = buildCircuitStations(planExercises);
  return stations.find((station) => station.memberIndices.includes(index)) ?? null;
}

export function nextCircuitStationEntry(
  currentIndex: number,
  planExercises: EditableWorkoutExercise[],
): { entryIndex: number; isLastStation: boolean } | null {
  const stations = buildCircuitStations(planExercises);
  const currentStation = circuitStationForIndex(currentIndex, planExercises);
  if (!currentStation) return null;
  const stationIndex = stations.findIndex((s) => s.entryIndex === currentStation.entryIndex);
  if (stationIndex < 0) return null;
  const next = stations[stationIndex + 1];
  if (next) return { entryIndex: next.entryIndex, isLastStation: false };
  return { entryIndex: stations[0].entryIndex, isLastStation: true };
}

export function resolvePostSetSupersetAction(
  currentIndex: number,
  planExercises: EditableWorkoutExercise[],
  sessionExercises: WorkoutExercise[],
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

export function executionModeUsesSupersetRotation(mode: WorkoutExecutionMode): boolean {
  return mode === 'superset' || mode === 'circuit';
}

export function resolvePostSetFlowAction(
  currentIndex: number,
  planExercises: EditableWorkoutExercise[],
  sessionExercises: WorkoutExercise[],
  executionMode: WorkoutExecutionMode,
  circuitRound: number,
  setsJustLoggedOverride?: number,
): PostSetFlowAction {
  const supersetAction = executionModeUsesSupersetRotation(executionMode)
    ? resolvePostSetSupersetAction(
        currentIndex,
        planExercises,
        sessionExercises,
        setsJustLoggedOverride,
      )
    : { skipRest: false, immediateAdvanceIndex: null, afterRestAdvanceIndex: null };

  if (executionMode !== 'circuit') {
    return { ...supersetAction, circuitTimer: null };
  }

  const setsJustLogged =
    setsJustLoggedOverride ?? sessionExercises[currentIndex]?.sets?.length ?? 0;
  const group = getSupersetGroupForIndex(currentIndex, planExercises);
  const config = CIRCUIT_MODE_DEFAULTS;

  if (supersetAction.immediateAdvanceIndex != null) {
    return {
      ...supersetAction,
      skipRest: true,
      circuitTimer: null,
    };
  }

  if (supersetAction.afterRestAdvanceIndex != null) {
    return {
      skipRest: true,
      immediateAdvanceIndex: null,
      afterRestAdvanceIndex: supersetAction.afterRestAdvanceIndex,
      circuitTimer: {
        phase: 'round_rest',
        seconds: Math.max(
          SUPERSET_MODE_DEFAULTS.restBetweenRoundSetsSeconds,
          CIRCUIT_MODE_DEFAULTS.restBetweenRoundsSeconds,
        ),
        round: circuitRound,
        advanceIndex: supersetAction.afterRestAdvanceIndex,
      },
    };
  }

  const station = circuitStationForIndex(currentIndex, planExercises);
  if (!station) {
    return { ...supersetAction, circuitTimer: null };
  }

  const stationComplete = station.memberIndices.every((index) => {
    const logged = sessionExercises[index]?.sets?.length ?? 0;
    return logged >= setsJustLogged;
  });

  if (!stationComplete) {
    return { ...supersetAction, circuitTimer: null };
  }

  const target = targetSetsForIndex(currentIndex, planExercises);
  if (setsJustLogged >= target) {
    return { ...supersetAction, circuitTimer: null };
  }

  const nextStation = nextCircuitStationEntry(currentIndex, planExercises);
  if (!nextStation) {
    return { ...supersetAction, circuitTimer: null };
  }

  if (nextStation.isLastStation) {
    if (circuitRound >= config.rounds) {
      return { ...supersetAction, circuitTimer: null };
    }
    return {
      skipRest: true,
      immediateAdvanceIndex: null,
      afterRestAdvanceIndex: null,
      circuitTimer: {
        phase: 'round_rest',
        seconds: config.restBetweenRoundsSeconds,
        round: circuitRound,
        advanceIndex: nextStation.entryIndex,
      },
    };
  }

  return {
    skipRest: true,
    immediateAdvanceIndex: null,
    afterRestAdvanceIndex: null,
    circuitTimer: {
      phase: 'transition',
      seconds: config.restBetweenExercisesSeconds,
      round: circuitRound,
      advanceIndex: nextStation.entryIndex,
    },
  };
}

export function nextExerciseIndexAfterGroup(
  group: SupersetGroup,
  totalExercises: number,
): number | null {
  const lastInGroup = Math.max(...group.memberIndices);
  const next = lastInGroup + 1;
  return next < totalExercises ? next : null;
}

/** Use superset rotation when the plan pairs exercises, unless user chose tabata/circuit/hiit. */
export function inferExecutionModeFromPlan(
  planExercises: EditableWorkoutExercise[],
  preferred: WorkoutExecutionMode,
): WorkoutExecutionMode {
  if (preferred === 'tabata' || preferred === 'circuit' || preferred === 'hiit') {
    return preferred;
  }
  if (buildSupersetGroups(planExercises).length > 0) {
    return 'superset';
  }
  return preferred;
}

export function formatSupersetPartnerNames(
  group: SupersetGroup,
  planExercises: EditableWorkoutExercise[],
  sessionExercises: WorkoutExercise[],
): string {
  return group.memberIndices
    .map((index) => sessionExercises[index]?.exercise?.name ?? planExercises[index]?.name ?? 'Exercise')
    .join(' · ');
}

/** Set/exercise labels during superset rotation (A1 · Set 2/3, partner up next). */
export function resolveSupersetWorkoutPosition(
  currentIndex: number,
  planExercises: EditableWorkoutExercise[],
  sessionExercises: WorkoutExercise[],
  targetSetsForIndex: (index: number) => number,
  isLastExercise: boolean,
): WorkoutPositionLabels {
  const planExercise = planExercises[currentIndex];
  const sessionExercise = sessionExercises[currentIndex];
  const exerciseName = sessionExercise?.exercise?.name ?? planExercise?.name ?? 'Exercise';
  const completed = sessionExercise?.sets?.length ?? 0;
  const target = targetSetsForIndex(currentIndex);
  const activeSet = Math.min(completed + 1, target);
  const station = formatExerciseStationLabel(planExercise, currentIndex, planExercises);
  const currentSetLabel = station
    ? `${station} · Set ${activeSet}/${target}`
    : `Set ${activeSet} of ${target}`;

  const group = getSupersetGroupForIndex(currentIndex, planExercises);
  if (!group || group.memberIndices.length < 2) {
    return resolveWorkoutUpNext({
      exerciseName,
      targetSets: target,
      completedSetsCount: completed,
      isLastExercise,
      nextExerciseName: sessionExercises[currentIndex + 1]?.exercise?.name,
      nextExerciseTargetSets: planExercises[currentIndex + 1]?.sets,
    });
  }

  const ordered = [...group.memberIndices].sort((a, b) => a - b);
  const currentPos = ordered.indexOf(currentIndex);
  const nextSetNumber = completed + 1;

  for (let offset = 1; offset < ordered.length; offset += 1) {
    const partnerIndex = ordered[(currentPos + offset) % ordered.length];
    const partnerCompleted = sessionExercises[partnerIndex]?.sets?.length ?? 0;
    if (partnerCompleted < nextSetNumber) {
      const partnerName =
        sessionExercises[partnerIndex]?.exercise?.name ?? planExercises[partnerIndex]?.name ?? 'Partner';
      const partnerStation = formatExerciseStationLabel(planExercises[partnerIndex], partnerIndex, planExercises);
      const partnerTarget = targetSetsForIndex(partnerIndex);
      const partnerSet = partnerCompleted + 1;
      const partnerLabel = partnerStation
        ? `${partnerName} (${partnerStation}) · Set ${partnerSet}/${partnerTarget}`
        : `${partnerName} · Set ${partnerSet}/${partnerTarget}`;
      const goNow = partnerCompleted < completed;
      const partnerLetter = getSupersetLabel(group, partnerIndex);
      const goNowLabel = partnerLetter
        ? `Next: ${partnerLetter} · ${partnerName} — go now`
        : `Next: ${partnerName} — go now`;
      return {
        exerciseName,
        currentSetLabel,
        upNextLabel: goNow ? goNowLabel : partnerLabel,
      };
    }
  }

  const firstIdx = ordered[0];
  const firstName = sessionExercises[firstIdx]?.exercise?.name ?? planExercises[firstIdx]?.name ?? 'Exercise';
  const firstCompleted = sessionExercises[firstIdx]?.sets?.length ?? 0;
  const firstTarget = targetSetsForIndex(firstIdx);

  if (nextSetNumber <= target) {
    return {
      exerciseName,
      currentSetLabel,
      upNextLabel: `Rest · then ${firstName} · Set ${firstCompleted + 1}/${firstTarget}`,
    };
  }

  const afterGroup = nextExerciseIndexAfterGroup(group, sessionExercises.length);
  if (afterGroup != null) {
    const nextName = sessionExercises[afterGroup]?.exercise?.name ?? planExercises[afterGroup]?.name;
    const nextTarget = targetSetsForIndex(afterGroup);
    return {
      exerciseName,
      currentSetLabel,
      upNextLabel: nextName ? `${nextName} · Set 1/${nextTarget}` : 'Finish workout',
    };
  }

  return { exerciseName, currentSetLabel, upNextLabel: 'Finish workout' };
}

export function shouldShowSupersetPrep(
  currentIndex: number,
  planExercises: EditableWorkoutExercise[],
  sessionExercises: WorkoutExercise[],
): SupersetGroup | null {
  const group = getSupersetGroupForIndex(currentIndex, planExercises);
  if (!group || group.memberIndices.length < 2) return null;
  const entryIndex = Math.min(...group.memberIndices);
  if (currentIndex !== entryIndex) return null;
  const completed = sessionExercises[currentIndex]?.sets?.length ?? 0;
  if (completed > 0) return null;
  return group;
}
