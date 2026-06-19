import { inferProgramType, type ProgramSelectionInput } from './programSelection.js';

/** User-selected lifting frequency (3–6). Cardio/sports never occupy these slots. */
export const LIFTING_DAYS_OPTIONS = [3, 4, 5, 6] as const;
export type LiftingDaysPerWeek = (typeof LIFTING_DAYS_OPTIONS)[number];

export type WeeklyLiftingSplit = 'push_pull_legs' | 'upper_lower';

export type LiftingProgramType =
  | 'push_pull_legs'
  | 'upper_lower'
  | 'full_body'
  | 'body_part_split'
  | 'strength';

export type LiftingProgramFrequency = 3 | 4 | 5 | 6 | 'custom';

/**
 * Seven-day patterns (Mon–Sun). Every non-rest label is a lifting session.
 * Conditioning/cardio/running/swimming are intentionally excluded — they never replace lifting.
 */
const WEEKLY_LIFTING_PATTERNS: Record<
  LiftingProgramType,
  Record<LiftingDaysPerWeek, readonly string[]>
> = {
  push_pull_legs: {
    3: ['Push', 'Pull', 'Legs', 'Rest', 'Rest', 'Rest', 'Rest'],
    4: ['Push', 'Pull', 'Legs', 'Push', 'Rest', 'Rest', 'Rest'],
    5: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Rest', 'Rest'],
    6: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs', 'Rest'],
  },
  upper_lower: {
    3: ['Upper', 'Lower', 'Upper', 'Rest', 'Rest', 'Rest', 'Rest'],
    4: ['Upper', 'Lower', 'Rest', 'Upper', 'Lower', 'Rest', 'Rest'],
    5: ['Upper', 'Lower', 'Upper', 'Lower', 'Upper', 'Rest', 'Rest'],
    6: ['Upper', 'Lower', 'Upper', 'Lower', 'Upper', 'Lower', 'Rest'],
  },
  full_body: {
    3: ['Full Body', 'Rest', 'Full Body', 'Rest', 'Full Body', 'Rest', 'Rest'],
    4: ['Full Body', 'Rest', 'Full Body', 'Rest', 'Full Body', 'Rest', 'Full Body'],
    5: ['Full Body', 'Rest', 'Full Body', 'Full Body', 'Rest', 'Full Body', 'Full Body'],
    6: ['Full Body', 'Full Body', 'Full Body', 'Full Body', 'Full Body', 'Full Body', 'Rest'],
  },
  body_part_split: {
    3: ['Back & Biceps & Shoulders', 'Chest & Triceps', 'Legs', 'Rest', 'Rest', 'Rest', 'Rest'],
    4: ['Back & Biceps & Shoulders', 'Chest & Triceps', 'Legs', 'Back & Biceps & Shoulders', 'Rest', 'Rest', 'Rest'],
    5: ['Back & Biceps & Shoulders', 'Chest & Triceps', 'Legs', 'Back & Biceps & Shoulders', 'Chest & Triceps', 'Rest', 'Rest'],
    6: ['Back & Biceps & Shoulders', 'Chest & Triceps', 'Legs', 'Back & Biceps & Shoulders', 'Chest & Triceps', 'Legs', 'Rest'],
  },
  strength: {
    3: ['Squat Day', 'Bench Day', 'Deadlift Day', 'Rest', 'Rest', 'Rest', 'Rest'],
    4: ['Squat Day', 'Bench Day', 'Rest', 'Deadlift Day', 'Press Day', 'Rest', 'Rest'],
    5: ['Squat Day', 'Bench Day', 'Deadlift Day', 'Press Day', 'Squat Day', 'Rest', 'Rest'],
    6: ['Squat Day', 'Bench Day', 'Deadlift Day', 'Press Day', 'Squat Day', 'Bench Day', 'Rest'],
  },
};

export function resolveLiftingDaysPerWeek(days?: number): LiftingDaysPerWeek {
  if (days === 3 || days === 4 || days === 5 || days === 6) return days;
  return 4;
}

export function inferWeeklyLiftingSplit(input: ProgramSelectionInput): WeeklyLiftingSplit {
  const programType = inferProgramType(input);
  return programType === 'upper_lower' ? 'upper_lower' : 'push_pull_legs';
}

export function getWeeklyLiftingPattern(
  programType: LiftingProgramType,
  liftingDays: LiftingDaysPerWeek,
): readonly string[] {
  return WEEKLY_LIFTING_PATTERNS[programType][liftingDays];
}

export function getWeeklyLiftingPatternForFrequency(
  programType: LiftingProgramType,
  frequency: LiftingProgramFrequency,
): readonly string[] {
  const liftingDays = frequency === 'custom' ? 4 : resolveLiftingDaysPerWeek(frequency);
  return getWeeklyLiftingPattern(programType, liftingDays);
}

export function countLiftingDaysInPattern(pattern: readonly string[]): number {
  return pattern.filter(
    (label) => label !== 'Rest' && !label.toLowerCase().includes('condition'),
  ).length;
}

export function patternIncludesNonLiftingReplacement(pattern: readonly string[]): boolean {
  return pattern.some((label) => {
    const key = label.toLowerCase();
    return (
      key.includes('condition') ||
      key.includes('cardio') ||
      key.includes('run') ||
      key.includes('swim') ||
      key.includes('sport')
    );
  });
}

export function formatWeeklyPattern(pattern: readonly string[]): string {
  return pattern.join(' · ');
}

export function buildWeeklyLiftingPlan(input: {
  programType: LiftingProgramType;
  liftingDaysPerWeek: number;
  fitnessGoals?: string[];
  primaryGoal?: string;
  experience?: string;
}) {
  const liftingDays = resolveLiftingDaysPerWeek(input.liftingDaysPerWeek);
  const split = inferWeeklyLiftingSplit({
    fitnessGoals: input.fitnessGoals,
    primaryGoal: input.primaryGoal,
    experience: input.experience,
    daysPerWeek: liftingDays,
  });
  const pattern = getWeeklyLiftingPattern(input.programType, liftingDays);

  return {
    programType: input.programType,
    recommendedSplit: split,
    liftingDaysPerWeek: liftingDays,
    pattern: [...pattern],
    liftingDayCount: countLiftingDaysInPattern(pattern),
  };
}
