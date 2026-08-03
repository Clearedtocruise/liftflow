import { CIRCUIT_MODE_DEFAULTS } from '@/constants/workoutExecutionModes';
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

export function enrichWithSupersetGroups(
  exercises: EditableWorkoutExercise[],
  _executionMode: WorkoutExecutionMode | undefined,
): EditableWorkoutExercise[] {
  // Group ids must come from the generated plan or explicit draft edits. Blindly pairing every
  // adjacent exercise when a workout is in superset mode turns partially-grouped plans into
  // "everything is a superset", which is exactly the production bug we want to avoid.
  // Plans already saved with that bug still need scrubbing on load.
  return sanitizeOverpairedSupersets(exercises);
}

/**
 * Signature of the empty-metadata auto-pair bug: nearly every exercise sits in an adjacent
 * 2-person group (ss-1, ss-2, …). Real Month 1 / smart plans leave compounds alone, so only a
 * minority of the session is paired. Strip the groups so the session runs traditionally.
 */
export function sanitizeOverpairedSupersets(
  exercises: EditableWorkoutExercise[],
): EditableWorkoutExercise[] {
  if (exercises.length < 4) return exercises;

  const groups = buildSupersetGroups(exercises);
  if (groups.length < 3) return exercises;

  const memberCount = new Set(groups.flatMap((group) => group.memberIndices)).size;
  if (memberCount / exercises.length < 0.75) return exercises;

  const allAdjacentPairs = groups.every(
    (group) =>
      group.memberIndices.length === 2 &&
      Math.abs(group.memberIndices[0]! - group.memberIndices[1]!) === 1,
  );
  if (!allAdjacentPairs) return exercises;

  return exercises.map((exercise) => {
    if (!exercise.supersetGroupId) return exercise;
    const { supersetGroupId: _removed, ...rest } = exercise;
    return rest;
  });
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

/**
 * A1, A2, B1, … based on superset group id and position within group.
 * Month 1 reference plans use letter ids (`ss-b`); adaptive plans use numeric (`ss-1`).
 */
export function formatSupersetStationLabel(
  supersetGroupId: string | undefined,
  positionInGroup: number,
): string | null {
  if (!supersetGroupId || positionInGroup < 0) return null;
  const raw = supersetGroupId.replace(/^ss-/i, '').trim();
  if (!raw) return null;

  let letter: string | null = null;
  if (/^[a-z]$/i.test(raw)) {
    letter = raw.toUpperCase();
  } else {
    const groupNum = Number(raw);
    if (Number.isFinite(groupNum) && groupNum >= 1) {
      letter = String.fromCharCode(64 + groupNum);
    }
  }
  if (!letter) return null;
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

export type CircuitPlanConfig = {
  rounds: number;
  restBetweenExercisesSeconds: number;
  restBetweenRoundsSeconds: number;
};

/** Circuit timing comes from the plan when it carries any, otherwise from the mode defaults. */
export function resolveCircuitPlanConfig(planExercises: EditableWorkoutExercise[]): CircuitPlanConfig {
  const withRounds = planExercises.find((exercise) => (exercise.intervalRounds ?? 0) > 0);
  const withTransition = planExercises.find((exercise) => exercise.restBetweenExercisesSeconds != null);
  const withRoundRest = planExercises.find((exercise) => (exercise.restSeconds ?? 0) > 0);
  return {
    rounds: withRounds?.intervalRounds ?? CIRCUIT_MODE_DEFAULTS.rounds,
    restBetweenExercisesSeconds:
      withTransition?.restBetweenExercisesSeconds ?? CIRCUIT_MODE_DEFAULTS.restBetweenExercisesSeconds,
    restBetweenRoundsSeconds: withRoundRest?.restSeconds ?? CIRCUIT_MODE_DEFAULTS.restBetweenRoundsSeconds,
  };
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
  const config = resolveCircuitPlanConfig(planExercises);

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
        phase: 'transition',
        seconds: config.restBetweenExercisesSeconds,
        round: circuitRound,
        advanceIndex: supersetAction.afterRestAdvanceIndex,
      },
    };
  }

  const station = circuitStationForIndex(currentIndex, planExercises);
  if (!station) {
    return { ...supersetAction, circuitTimer: null };
  }

  // A member with a lower target finishes early; it must not hold the station open forever.
  const stationComplete = station.memberIndices.every((index) => {
    const logged = sessionExercises[index]?.sets?.length ?? 0;
    return logged >= Math.min(setsJustLogged, targetSetsForIndex(index, planExercises));
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

/**
 * Next exercise that is not part of the group. Groups can be non-contiguous, so jumping past
 * the highest member index would silently skip the exercises interleaved between members.
 */
export function nextExerciseIndexAfterGroup(
  group: SupersetGroup,
  totalExercises: number,
): number | null {
  const members = new Set(group.memberIndices);
  for (let next = Math.min(...group.memberIndices) + 1; next < totalExercises; next += 1) {
    if (!members.has(next)) return next;
  }
  return null;
}

/** An explicit mode choice always wins; only an unopinionated plan infers superset from its groups. */
export function inferExecutionModeFromPlan(
  planExercises: EditableWorkoutExercise[],
  preferred: WorkoutExecutionMode,
): WorkoutExecutionMode {
  if (preferred !== 'traditional') return preferred;
  // Scrub over-paired plans before deciding — otherwise a bad saved plan forces supersets mode
  // even after enrichWithSupersetGroups would have stripped the groups for execution.
  if (buildSupersetGroups(sanitizeOverpairedSupersets(planExercises)).length > 0) {
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
      return {
        exerciseName,
        currentSetLabel,
        upNextLabel: goNow ? `${partnerLabel} · go now` : partnerLabel,
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
