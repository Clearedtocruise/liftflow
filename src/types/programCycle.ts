import type { ProgramCycle } from '@/lib/programCycle';
import type { TemplateExercise } from '@/types/training';

/** One day the user is authoring in the create/edit screen. */
export type CycleDayInput = {
  label?: string;
  isRest?: boolean;
  exercises?: TemplateExercise[];
};

export type CycleProgramInput = {
  name?: string;
  lengthDays: number;
  days: CycleDayInput[];
};

/** Server response describing the active cycle and which day is up next. */
export type CycleStatus = {
  programId: string;
  cycle: ProgramCycle;
  activeDayNumber: number;
  activeDay: ProgramCycle['days'][number] | undefined;
  today: string;
};

export type PreviousPerformance = {
  weightKg: number | null;
  reps: number | null;
  loggedAt: string;
};
