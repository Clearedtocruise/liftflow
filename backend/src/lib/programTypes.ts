export type ProgramType =
  | 'push_pull_legs'
  | 'upper_lower'
  | 'full_body'
  | 'body_part_split'
  | 'strength';

export type ProgramFrequency = 3 | 4 | 5 | 6 | 'custom';

export type SprintPhaseName = 'accumulation' | 'intensification' | 'deload' | 'peak' | 'recovery';

export type DaySlot = {
  dayIndex: number;
  label: string;
  isRest: boolean;
  muscleGroups: string[];
  workoutType?: string;
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
  if (key.includes('push')) return ['chest', 'shoulders', 'triceps'];
  if (key.includes('pull')) return ['back', 'biceps'];
  if (key.includes('leg')) return ['legs', 'glutes', 'hamstrings'];
  if (key.includes('upper')) return ['chest', 'back', 'shoulders', 'arms'];
  if (key.includes('lower')) return ['legs', 'glutes', 'hamstrings'];
  if (key.includes('full')) return ['chest', 'back', 'legs', 'shoulders'];
  if (key.includes('chest')) return ['chest', 'triceps'];
  if (key.includes('back')) return ['back', 'biceps'];
  if (key.includes('shoulder')) return ['shoulders'];
  if (key.includes('arm')) return ['arms', 'biceps', 'triceps'];
  if (key.includes('squat')) return ['legs', 'glutes'];
  if (key.includes('bench') || key.includes('press')) return ['chest', 'shoulders', 'triceps'];
  if (key.includes('deadlift')) return ['back', 'legs', 'hamstrings'];
  if (key.includes('recovery') || key.includes('rest')) return ['core'];
  return ['chest', 'back', 'legs'];
}

function restDay(index: number): DaySlot {
  return { dayIndex: index, label: 'Rest', isRest: true, muscleGroups: [] };
}

function workoutDay(index: number, label: string): DaySlot {
  return {
    dayIndex: index,
    label,
    isRest: false,
    muscleGroups: muscleGroupsForWorkout(label),
    workoutType: label.toLowerCase().replace(/\s+/g, '_'),
  };
}

const SCHEDULES: Record<ProgramType, Record<number, string[]>> = {
  push_pull_legs: {
    3: ['Push', 'Pull', 'Legs', 'Rest', 'Rest', 'Rest', 'Rest'],
    4: ['Push', 'Pull', 'Rest', 'Legs', 'Rest', 'Rest', 'Rest'],
    5: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Rest', 'Rest'],
    6: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs', 'Rest'],
  },
  upper_lower: {
    3: ['Upper', 'Lower', 'Rest', 'Upper', 'Rest', 'Rest', 'Rest'],
    4: ['Upper', 'Lower', 'Rest', 'Upper', 'Lower', 'Rest', 'Rest'],
    5: ['Upper', 'Lower', 'Upper', 'Lower', 'Rest', 'Rest', 'Rest'],
    6: ['Upper', 'Lower', 'Upper', 'Lower', 'Upper', 'Lower', 'Rest'],
  },
  full_body: {
    3: ['Full Body', 'Rest', 'Full Body', 'Rest', 'Full Body', 'Rest', 'Rest'],
    4: ['Full Body', 'Rest', 'Full Body', 'Rest', 'Full Body', 'Rest', 'Full Body'],
    5: ['Full Body', 'Rest', 'Full Body', 'Rest', 'Full Body', 'Rest', 'Full Body'],
    6: ['Full Body', 'Rest', 'Full Body', 'Rest', 'Full Body', 'Rest', 'Full Body'],
  },
  body_part_split: {
    3: ['Chest', 'Back', 'Legs', 'Rest', 'Rest', 'Rest', 'Rest'],
    4: ['Chest', 'Back', 'Legs', 'Shoulders', 'Rest', 'Rest', 'Rest'],
    5: ['Chest', 'Back', 'Shoulders', 'Legs', 'Arms', 'Rest', 'Rest'],
    6: ['Chest', 'Back', 'Shoulders', 'Legs', 'Arms', 'Core', 'Rest'],
  },
  strength: {
    3: ['Squat Day', 'Bench Day', 'Deadlift Day', 'Rest', 'Rest', 'Rest', 'Rest'],
    4: ['Squat Day', 'Bench Day', 'Rest', 'Deadlift Day', 'Press Day', 'Rest', 'Rest'],
    5: ['Squat Day', 'Bench Day', 'Rest', 'Deadlift Day', 'Press Day', 'Rest', 'Rest'],
    6: ['Squat Day', 'Bench Day', 'Deadlift Day', 'Press Day', 'Squat Day', 'Rest', 'Rest'],
  },
};

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

  const freq = frequency === 'custom' ? 4 : frequency;
  const pattern = SCHEDULES[programType][freq] ?? SCHEDULES[programType][4];

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

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekStartFromDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

export function currentProgramWeek(startDate: string, today = new Date().toISOString().slice(0, 10)): number {
  const start = new Date(startDate + 'T12:00:00').getTime();
  const now = new Date(today + 'T12:00:00').getTime();
  const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.floor(diffDays / 7) + 1);
}
