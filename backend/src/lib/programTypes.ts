import { getWeeklyLiftingPatternForFrequency } from './weeklyLiftingGenerator.js';

export type ProgramType =
  | 'push_pull_legs'
  | 'upper_lower'
  | 'full_body'
  | 'body_part_split'
  | 'strength';

export type ProgramFrequency = 3 | 4 | 5 | 6 | 7 | 'custom';

export type SprintPhaseName = 'accumulation' | 'intensification' | 'deload' | 'peak' | 'recovery';

export type DaySlot = {
  dayIndex: number;
  label: string;
  isRest: boolean;
  muscleGroups: string[];
  workoutType?: string;
  sessionKind?: 'strength' | 'cardio' | 'mobility';
};

export type PhaseSpec = {
  sprintPhase: SprintPhaseName;
  phaseType: 'hypertrophy' | 'strength' | 'power' | 'deload' | 'maintenance';
  volumeMultiplier: number;
  intensityMultiplier: number;
  repRangeAdjust?: string;
};

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function dayLabel(index: number): string {
  return DAY_LABELS[index] ?? `Day ${index + 1}`;
}

export function muscleGroupsForWorkout(label: string): string[] {
  const key = label.toLowerCase();
  if (key.includes('condition')) return ['core', 'legs'];
  if (key.includes('back') && key.includes('biceps')) {
    return ['back', 'biceps', 'core'];
  }
  if (key.includes('chest') && key.includes('shoulder') && key.includes('triceps')) {
    return ['chest', 'shoulders', 'triceps', 'core'];
  }
  if (key.includes('legs') && key.includes('core')) {
    return ['quads', 'hamstrings', 'glutes', 'calves', 'core'];
  }
  if (key.includes('back & biceps & core') || key.includes('back, biceps & core')) {
    return ['back', 'biceps', 'core'];
  }
  if (key.includes('chest & shoulders & triceps') || key.includes('chest, shoulders & triceps')) {
    return ['chest', 'shoulders', 'triceps', 'core'];
  }
  if (key.includes('legs & lower back & core') || key.includes('legs & core')) {
    return ['quads', 'hamstrings', 'glutes', 'calves', 'core'];
  }
  if (key.includes('back & biceps') || (key.includes('back') && key.includes('biceps') && key.includes('shoulder'))) {
    return ['back', 'biceps', 'core'];
  }
  if (key.includes('chest & triceps') || (key.includes('chest') && key.includes('triceps'))) {
    return ['chest', 'triceps', 'core'];
  }
  if (key.includes('push')) return ['chest', 'triceps', 'core'];
  if (key.includes('pull')) return ['back', 'biceps', 'shoulders', 'core'];
  if (key.includes('leg')) return ['legs', 'glutes', 'hamstrings', 'core'];
  if (key.includes('upper')) return ['chest', 'back', 'shoulders', 'core'];
  if (key.includes('lower')) return ['legs', 'glutes', 'hamstrings', 'core'];
  if (key.includes('full')) return ['chest', 'back', 'legs', 'shoulders', 'core'];
  if (key.includes('chest')) return ['chest', 'triceps', 'core'];
  if (key.includes('back')) return ['back', 'biceps', 'core'];
  if (key.includes('shoulder')) return ['shoulders', 'core'];
  if (key.includes('arm')) return ['arms', 'biceps', 'triceps'];
  if (key.includes('squat')) return ['legs', 'glutes', 'core'];
  if (key.includes('bench') || key.includes('press')) return ['chest', 'shoulders', 'triceps', 'core'];
  if (key.includes('deadlift')) return ['back', 'legs', 'hamstrings', 'core'];
  if (key.includes('recovery') || key.includes('rest')) return ['core'];
  return ['chest', 'back', 'legs', 'core'];
}

function restDay(index: number): DaySlot {
  return { dayIndex: index, label: 'Rest', isRest: true, muscleGroups: [] };
}

function workoutDay(index: number, label: string): DaySlot {
  const isConditioning = label.toLowerCase().includes('condition');
  return {
    dayIndex: index,
    label,
    isRest: false,
    muscleGroups: muscleGroupsForWorkout(label),
    workoutType: label.toLowerCase().replace(/\s+/g, '_'),
    sessionKind: isConditioning ? 'cardio' : 'strength',
  };
}

const UPPER_FOCUS_PATTERN =
  /push|upper|chest|bench|shoulder|arm|full body|full_body|press day|press/i;

function isUpperFocusLabel(label: string): boolean {
  if (label.toLowerCase() === 'rest') return false;
  return UPPER_FOCUS_PATTERN.test(label);
}

/**
 * Prefer spacing consecutive upper-focused sessions by swapping with an existing Rest day.
 * Never converts a lift day into Rest — that would silently drop below the user's frequency
 * (e.g. 6-day full body collapsing to 3 lift days).
 */
export function enforceUpperFocusSpacing(labels: readonly string[]): string[] {
  const result = [...labels];
  for (let i = 0; i < result.length - 1; i += 1) {
    if (
      result[i] === 'Rest' ||
      result[i + 1] === 'Rest' ||
      !isUpperFocusLabel(result[i]!) ||
      !isUpperFocusLabel(result[i + 1]!)
    ) {
      continue;
    }

    let swapIdx = -1;
    for (let j = i + 2; j < result.length; j += 1) {
      if (result[j] !== 'Rest') continue;
      const prev = result[j - 1];
      const next = result[j + 1];
      const createsNewPair =
        (prev != null && prev !== 'Rest' && isUpperFocusLabel(prev) && isUpperFocusLabel(result[i + 1]!)) ||
        (next != null && next !== 'Rest' && isUpperFocusLabel(result[i + 1]!) && isUpperFocusLabel(next));
      if (!createsNewPair) {
        swapIdx = j;
        break;
      }
      if (swapIdx < 0) swapIdx = j;
    }

    if (swapIdx >= 0) {
      const moving = result[i + 1]!;
      result[i + 1] = 'Rest';
      result[swapIdx] = moving;
    }
  }
  return result;
}

export function countLiftSlotsInSchedule(
  schedule: ReadonlyArray<{ isRest?: boolean; label?: string }>,
): number {
  return schedule.filter((day) => {
    if (day.isRest) return false;
    const label = (day.label ?? '').toLowerCase();
    return label !== 'rest' && !label.includes('condition');
  }).length;
}

export function buildWeeklySchedule(
  programType: ProgramType,
  frequency: ProgramFrequency,
  customDays?: string[],
): DaySlot[] {
  if (frequency === 'custom' && customDays?.length === 7) {
    return customDays.map((label, index) =>
      label.toLowerCase() === 'rest' ? restDay(index) : workoutDay(index, label),
    );
  }

  const rawPattern = getWeeklyLiftingPatternForFrequency(programType, frequency);
  const pattern =
    programType === 'body_part_split' ? rawPattern : enforceUpperFocusSpacing(rawPattern);

  return pattern.map((label, index) =>
    label === 'Rest' ? restDay(index) : workoutDay(index, label),
  );
}

export function programTypeLabel(type: ProgramType): string {
  const labels: Record<ProgramType, string> = {
    push_pull_legs: 'Push Pull Legs',
    upper_lower: 'Upper Lower',
    full_body: 'Full Body',
    body_part_split: 'Body Part Split',
    strength: 'Strength Program',
  };
  return labels[type];
}

export function phaseForWeek(weekNumber: number, totalWeeks = 12): PhaseSpec {
  if (totalWeeks <= 4) {
    return { sprintPhase: 'accumulation', phaseType: 'hypertrophy', volumeMultiplier: 1, intensityMultiplier: 1 };
  }

  const deloadWeek = Math.max(4, Math.floor(totalWeeks * 0.75));
  const peakStart = deloadWeek + 1;
  const peakEnd = totalWeeks - 1;

  if (weekNumber >= totalWeeks) {
    return { sprintPhase: 'recovery', phaseType: 'maintenance', volumeMultiplier: 0.5, intensityMultiplier: 0.7, repRangeAdjust: '10-12' };
  }
  if (weekNumber === deloadWeek) {
    return { sprintPhase: 'deload', phaseType: 'deload', volumeMultiplier: 0.6, intensityMultiplier: 0.75, repRangeAdjust: '8-10' };
  }
  if (weekNumber >= peakStart && weekNumber <= peakEnd) {
    return { sprintPhase: 'peak', phaseType: 'power', volumeMultiplier: 0.85, intensityMultiplier: 1.05, repRangeAdjust: '3-5' };
  }
  if (weekNumber > Math.floor(totalWeeks / 2)) {
    return { sprintPhase: 'intensification', phaseType: 'strength', volumeMultiplier: 0.9, intensityMultiplier: 1, repRangeAdjust: '4-6' };
  }
  return { sprintPhase: 'accumulation', phaseType: 'hypertrophy', volumeMultiplier: 1, intensityMultiplier: 0.95, repRangeAdjust: '8-12' };
}

/**
 * These are calendar-date helpers, so every one of them anchors at noon UTC.
 *
 * They used to parse `"2026-03-02T12:00:00"` — no zone — which meant local-time arithmetic that was
 * then serialised back through `toISOString()` in UTC. Two things broke:
 *
 * - Across a spring-forward boundary a week is 167 hours, not 168, so `Math.floor(days / 7)` lost a
 *   week. In US timezones a program started before March reported the wrong week from the DST
 *   change onward, and never caught up.
 * - On a server at UTC+13 or later the local-to-UTC conversion moved the date back a day, so
 *   `weekStartFromDate` returned a Sunday instead of a Monday.
 *
 * Noon UTC also keeps the date stable against any sub-12-hour offset applied downstream.
 */
const NOON_UTC = 'T12:00:00.000Z';

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + NOON_UTC);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekStartFromDate(dateStr: string): string {
  const d = new Date(dateStr + NOON_UTC);
  const day = d.getUTCDay();
  // Sunday is the end of the training week, not the start of the next one.
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + mondayOffset);
  return d.toISOString().slice(0, 10);
}

export function currentProgramWeek(startDate: string, today = new Date().toISOString().slice(0, 10)): number {
  const start = new Date(startDate + NOON_UTC).getTime();
  const now = new Date(today + NOON_UTC).getTime();
  const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.floor(diffDays / 7) + 1);
}
