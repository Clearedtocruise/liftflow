/** Shared types for PDF / text program import. */

export type ProgramImportKind = 'workout' | 'nutrition' | 'both';

export type ProgramImportPreview = {
  kind: ProgramImportKind;
  title?: string;
  summary: string;
  pageCount?: number;
  workout: import('@/types/programCycle').CycleProgramInput | null;
  nutrition: {
    name?: string;
    goals?: {
      calories?: number;
      proteinG?: number;
      carbsG?: number;
      fatG?: number;
      waterMl?: number;
    };
    days: Array<{
      dayIndex: number;
      label?: string;
      meals: Array<{
        mealType: string;
        name: string;
        scheduledTime?: string;
        calories?: number;
        proteinG?: number;
        carbsG?: number;
        fatG?: number;
        notes?: string;
      }>;
    }>;
  } | null;
  warnings: string[];
  /** Which cycle day the document's own calendar puts today on, when it prints one. */
  startDay?: number;
  /** The calendar row startDay came from, as the document labels it. */
  startDayLabel?: string;
};

export type ProgramImportCommitResult = {
  preview: ProgramImportPreview;
  workout: import('@/types/programCycle').CycleStatus | null;
  nutrition: {
    planPack: string;
    weekStart: string;
    mealsInserted: number;
    mealsCleared: number;
    goalsUpdated: boolean;
  } | null;
};
