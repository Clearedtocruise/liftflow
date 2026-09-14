/**
 * Editable draft of a parsed program import.
 *
 * The importer reads a PDF into a `ProgramImportPreview` and used to commit that object verbatim,
 * so a misread rep range or a day the parser called "Day 3" instead of "Pull" could only be fixed
 * after the plan was already live. This module turns a preview into something the review screen
 * can edit and back again, keeping every mutation pure so the rules can be unit-tested without a
 * renderer.
 *
 * Workout days reuse `programCycleEditor`'s `DraftDay`, which is the same shape the custom program
 * editor works in — an imported plan and a hand-built one stay one format all the way through.
 */

import { cycleToDraft, draftToCycleInput, type DraftDay } from '@/lib/programCycleEditor';
import type { ProgramImportKind, ProgramImportPreview } from '@/types/programImport';
import { WORKOUT_EXECUTION_MODE_LABELS, type WorkoutExecutionMode } from '@/types/workoutExecutionMode';

export type DraftMeal = {
  mealType: string;
  name: string;
  scheduledTime?: string;
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  notes?: string;
};

export type DraftNutritionDay = {
  dayIndex: number;
  label: string;
  meals: DraftMeal[];
};

export type DraftNutritionGoals = {
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  waterMl?: number;
};

export type NutritionDraft = {
  name: string;
  goals: DraftNutritionGoals;
  days: DraftNutritionDay[];
};

export type ImportDraft = {
  title: string;
  workout: { name: string; days: DraftDay[] } | null;
  nutrition: NutritionDraft | null;
};

export const WEEKDAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Mirrors `ImportedMeal['mealType']` on the server, which rewrites anything it does not know. */
export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout'];

export function mealTypeLabel(mealType: string): string {
  return mealType.replace(/_/g, ' ');
}

/**
 * Parsers routinely emit "Day 3 — Pull" as the label of day 3, which then renders as
 * "Day 3: Day 3 — Pull". The ordinal is already shown next to the field, so strip it and let the
 * lifter name the day whatever they actually call it.
 */
export function stripDayOrdinal(label: string | undefined): string {
  return (label ?? '').replace(/^day\s*\d+\s*[—–:-]?\s*/i, '').trim();
}

export function defaultNutritionDayLabel(dayIndex: number): string {
  return WEEKDAY_LABELS[dayIndex] ?? `Day ${dayIndex + 1}`;
}

export function previewToImportDraft(preview: ProgramImportPreview): ImportDraft {
  return {
    title: preview.title ?? '',
    workout: preview.workout
      ? {
          name: preview.workout.name ?? preview.title ?? '',
          days: cycleToDraft(preview.workout.days).map((day, index) => ({
            ...day,
            label: stripDayOrdinal(day.label) || (day.isRest ? 'Rest' : `Day ${index + 1}`),
          })),
        }
      : null,
    nutrition: preview.nutrition
      ? {
          name: preview.nutrition.name ?? '',
          goals: { ...(preview.nutrition.goals ?? {}) },
          days: preview.nutrition.days.map((day) => ({
            dayIndex: day.dayIndex,
            label: day.label?.trim() || defaultNutritionDayLabel(day.dayIndex),
            meals: day.meals.map((meal) => ({ ...meal })),
          })),
        }
      : null,
  };
}

/**
 * Rebuild the preview the commit endpoint expects. Everything the user did not edit — warnings,
 * page count, the parser's own summary — is carried over from the original so the server still
 * sees the document it parsed.
 */
export function importDraftToPreview(
  draft: ImportDraft,
  original: ProgramImportPreview,
): ProgramImportPreview {
  return {
    ...original,
    title: draft.title.trim() || original.title,
    workout: draft.workout ? draftToCycleInput(draft.workout.name, draft.workout.days) : null,
    nutrition: draft.nutrition
      ? {
          name: draft.nutrition.name.trim() || undefined,
          goals: normalizeGoals(draft.nutrition.goals),
          days: draft.nutrition.days.map((day) => ({
            dayIndex: day.dayIndex,
            label: day.label.trim() || undefined,
            meals: day.meals
              .filter((meal) => meal.name.trim().length > 0)
              .map((meal) => ({
                ...meal,
                name: meal.name.trim(),
                mealType: meal.mealType.trim() || 'snack',
              })),
          })),
        }
      : null,
  };
}

function normalizeGoals(goals: DraftNutritionGoals): DraftNutritionGoals | undefined {
  const entries = Object.entries(goals).filter(([, value]) => typeof value === 'number' && value > 0);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export function setWorkoutName(draft: ImportDraft, name: string): ImportDraft {
  if (!draft.workout) return draft;
  return { ...draft, workout: { ...draft.workout, name } };
}

export function setWorkoutDays(draft: ImportDraft, days: DraftDay[]): ImportDraft {
  if (!draft.workout) return draft;
  return { ...draft, workout: { ...draft.workout, days } };
}

export function setNutritionName(draft: ImportDraft, name: string): ImportDraft {
  if (!draft.nutrition) return draft;
  return { ...draft, nutrition: { ...draft.nutrition, name } };
}

export function setNutritionGoal(
  draft: ImportDraft,
  key: keyof DraftNutritionGoals,
  value: number | undefined,
): ImportDraft {
  if (!draft.nutrition) return draft;
  return {
    ...draft,
    nutrition: {
      ...draft.nutrition,
      goals: { ...draft.nutrition.goals, [key]: value && value > 0 ? value : undefined },
    },
  };
}

export function setNutritionDayLabel(draft: ImportDraft, dayIndex: number, label: string): ImportDraft {
  return mapNutritionDay(draft, dayIndex, (day) => ({ ...day, label }));
}

export function updateMeal(
  draft: ImportDraft,
  dayIndex: number,
  mealIndex: number,
  patch: Partial<DraftMeal>,
): ImportDraft {
  return mapNutritionDay(draft, dayIndex, (day) => ({
    ...day,
    meals: day.meals.map((meal, index) => (index === mealIndex ? { ...meal, ...patch } : meal)),
  }));
}

export function removeMeal(draft: ImportDraft, dayIndex: number, mealIndex: number): ImportDraft {
  return mapNutritionDay(draft, dayIndex, (day) => ({
    ...day,
    meals: day.meals.filter((_, index) => index !== mealIndex),
  }));
}

export function addMeal(draft: ImportDraft, dayIndex: number): ImportDraft {
  return mapNutritionDay(draft, dayIndex, (day) => ({
    ...day,
    meals: [...day.meals, { mealType: nextMealType(day.meals.length), name: '' }],
  }));
}

function nextMealType(existingCount: number): string {
  return MEAL_TYPES[Math.min(existingCount, MEAL_TYPES.length - 1)] ?? 'snack';
}

function mapNutritionDay(
  draft: ImportDraft,
  dayIndex: number,
  map: (day: DraftNutritionDay) => DraftNutritionDay,
): ImportDraft {
  if (!draft.nutrition) return draft;
  return {
    ...draft,
    nutrition: {
      ...draft.nutrition,
      days: draft.nutrition.days.map((day) => (day.dayIndex === dayIndex ? map(day) : day)),
    },
  };
}

/**
 * What a draft still needs before it can be followed, phrased for the review screen. Deliberately
 * not the same as `isDraftValid`: an import can carry nutrition only, in which case having no
 * training day is the expected outcome rather than an error.
 */
export function importDraftIssue(draft: ImportDraft, kind: ProgramImportKind): string | undefined {
  const wantsWorkout = kind !== 'nutrition';
  const wantsNutrition = kind !== 'workout';

  if (!draft.workout && !draft.nutrition) {
    return 'Nothing was read from this plan yet.';
  }

  if (wantsWorkout && draft.workout) {
    const trainingDays = draft.workout.days.filter((day) => !day.isRest);
    if (trainingDays.length === 0) {
      return 'Mark at least one day as a workout day.';
    }
    if (trainingDays.every((day) => day.exercises.length === 0)) {
      return 'Add at least one exercise to a workout day.';
    }
    const unnamed = draft.workout.days.findIndex((day) => day.label.trim().length === 0);
    if (unnamed >= 0) {
      return `Give day ${unnamed + 1} a name.`;
    }
  }

  if (wantsNutrition && draft.nutrition && !draft.workout) {
    const meals = draft.nutrition.days.reduce((total, day) => total + day.meals.length, 0);
    const hasGoals = Object.values(draft.nutrition.goals).some((value) => (value ?? 0) > 0);
    if (meals === 0 && !hasGoals) {
      return 'Add a meal or a daily target before following this plan.';
    }
  }

  return undefined;
}

/** One-line "what you are about to follow", recomputed from the draft rather than the parse. */
export function describeImportDraft(draft: ImportDraft): string {
  const parts: string[] = [];
  if (draft.workout) {
    const training = draft.workout.days.filter((day) => !day.isRest).length;
    const rest = draft.workout.days.length - training;
    const exercises = draft.workout.days.reduce((total, day) => total + day.exercises.length, 0);
    parts.push(
      `${draft.workout.days.length}-day cycle · ${training} training · ${rest} rest · ${exercises} exercises`,
    );

    // Worth calling out: a day read as Tabata runs on the interval timer rather than as straight
    // sets, and that is the kind of thing a lifter wants to confirm before following the plan.
    const modeDays = draft.workout.days
      .map((day, index) => ({ day, number: index + 1 }))
      .filter(({ day }) => day.executionMode && day.executionMode !== 'traditional');
    for (const { day, number } of modeDays) {
      const mode = WORKOUT_EXECUTION_MODE_LABELS[day.executionMode as WorkoutExecutionMode];
      const timing =
        day.intervalWorkSeconds && day.intervalRestSeconds
          ? ` (${day.intervalWorkSeconds}s/${day.intervalRestSeconds}s${day.intervalRounds ? ` × ${day.intervalRounds}` : ''})`
          : '';
      parts.push(`Day ${number} runs as ${mode}${timing}`);
    }
  }
  if (draft.nutrition) {
    const meals = draft.nutrition.days.reduce((total, day) => total + day.meals.length, 0);
    const calories = draft.nutrition.goals.calories;
    parts.push(`${meals} meals${calories ? ` · ${calories} kcal/day` : ''}`);
  }
  return parts.join('\n');
}
