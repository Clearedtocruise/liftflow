/**
 * Turn extracted PDF / pasted plan text into a structured workout cycle and/or nutrition week
 * that can be committed into existing sinks (custom_cycle + meal_plans/meals).
 */

import { asPromptData, chatCompletionJson, hasOpenAI } from './openai.js';
import {
  CYCLE_MAX_DAYS,
  CYCLE_MIN_DAYS,
  clampCycleLength,
  type CycleTemplateExercise,
} from './programCycle.js';
import type { CycleProgramInput } from './programCycleService.js';

export type ImportKind = 'workout' | 'nutrition' | 'both';

export type ImportedMeal = {
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'pre_workout' | 'post_workout';
  name: string;
  scheduledTime?: string;
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  notes?: string;
};

export type ImportedNutritionDay = {
  /** 0 = Monday … 6 = Sunday when mapping onto a calendar week */
  dayIndex: number;
  label?: string;
  meals: ImportedMeal[];
};

export type ImportedNutritionPlan = {
  name?: string;
  goals?: {
    calories?: number;
    proteinG?: number;
    carbsG?: number;
    fatG?: number;
    waterMl?: number;
  };
  days: ImportedNutritionDay[];
};

export type ProgramImportPreview = {
  kind: ImportKind;
  title?: string;
  summary: string;
  workout: CycleProgramInput | null;
  nutrition: ImportedNutritionPlan | null;
  warnings: string[];
};

const MEAL_TYPES = new Set([
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'pre_workout',
  'post_workout',
]);

function sanitizeExercises(raw: unknown): CycleTemplateExercise[] {
  if (!Array.isArray(raw)) return [];
  const out: CycleTemplateExercise[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const name =
      typeof row.name === 'string'
        ? row.name.trim()
        : typeof row.exerciseName === 'string'
          ? row.exerciseName.trim()
          : '';
    if (!name) continue;
    const setsRaw = typeof row.sets === 'number' ? row.sets : Number(row.sets);
    const sets = Number.isFinite(setsRaw) && setsRaw > 0 ? Math.round(setsRaw) : 3;
    const reps =
      typeof row.reps === 'string'
        ? row.reps
        : typeof row.repRange === 'string'
          ? row.repRange
          : undefined;
    out.push({
      name,
      exerciseName: name,
      sets,
      reps,
      repRange: reps,
      restSeconds:
        Number.isFinite(Number(row.restSeconds)) && Number(row.restSeconds) > 0
          ? Math.round(Number(row.restSeconds))
          : undefined,
      weightLbs:
        Number.isFinite(Number(row.weightLbs)) && Number(row.weightLbs) > 0
          ? Number(row.weightLbs)
          : undefined,
      notes: typeof row.notes === 'string' ? row.notes : undefined,
    });
  }
  return out;
}

function sanitizeWorkout(raw: unknown): CycleProgramInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const daysIn = Array.isArray(row.days) ? row.days : [];
  if (daysIn.length === 0) return null;

  const days = daysIn.slice(0, CYCLE_MAX_DAYS).map((day, index) => {
    const d = (day && typeof day === 'object' ? day : {}) as Record<string, unknown>;
    const isRest = d.isRest === true || String(d.label ?? '').toLowerCase().includes('rest');
    const exercises = isRest ? [] : sanitizeExercises(d.exercises);
    return {
      label:
        typeof d.label === 'string' && d.label.trim()
          ? d.label.trim()
          : isRest
            ? `Day ${index + 1} Rest`
            : `Day ${index + 1}`,
      isRest: isRest || exercises.length === 0,
      exercises,
    };
  });

  const lengthDays = clampCycleLength(
    typeof row.lengthDays === 'number' ? row.lengthDays : days.length,
  );
  while (days.length < lengthDays) {
    days.push({ label: `Day ${days.length + 1} Rest`, isRest: true, exercises: [] });
  }

  const name = typeof row.name === 'string' && row.name.trim() ? row.name.trim() : undefined;
  return { name, lengthDays, days: days.slice(0, lengthDays) };
}

function sanitizeMeal(raw: unknown): ImportedMeal | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const name = typeof row.name === 'string' ? row.name.trim() : '';
  if (!name) return null;
  const mealTypeRaw = typeof row.mealType === 'string' ? row.mealType.trim().toLowerCase() : 'snack';
  const mealType = (MEAL_TYPES.has(mealTypeRaw) ? mealTypeRaw : 'snack') as ImportedMeal['mealType'];
  const num = (v: unknown) => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
  };
  return {
    mealType,
    name,
    scheduledTime: typeof row.scheduledTime === 'string' ? row.scheduledTime : undefined,
    calories: num(row.calories),
    proteinG: num(row.proteinG),
    carbsG: num(row.carbsG),
    fatG: num(row.fatG),
    notes: typeof row.notes === 'string' ? row.notes : undefined,
  };
}

function sanitizeNutrition(raw: unknown): ImportedNutritionPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const daysIn = Array.isArray(row.days) ? row.days : [];
  const days: ImportedNutritionDay[] = [];
  for (const day of daysIn) {
    if (!day || typeof day !== 'object') continue;
    const d = day as Record<string, unknown>;
    const dayIndexRaw = typeof d.dayIndex === 'number' ? d.dayIndex : Number(d.dayIndex);
    const dayIndex = Number.isFinite(dayIndexRaw)
      ? Math.max(0, Math.min(6, Math.round(dayIndexRaw)))
      : days.length % 7;
    const meals = (Array.isArray(d.meals) ? d.meals : [])
      .map(sanitizeMeal)
      .filter((m): m is ImportedMeal => m != null);
    if (meals.length === 0) continue;
    days.push({
      dayIndex,
      label: typeof d.label === 'string' ? d.label : undefined,
      meals,
    });
  }
  if (days.length === 0) return null;

  const goalsRaw = row.goals && typeof row.goals === 'object' ? (row.goals as Record<string, unknown>) : null;
  const goals = goalsRaw
    ? {
        calories: Number.isFinite(Number(goalsRaw.calories)) ? Math.round(Number(goalsRaw.calories)) : undefined,
        proteinG: Number.isFinite(Number(goalsRaw.proteinG)) ? Math.round(Number(goalsRaw.proteinG)) : undefined,
        carbsG: Number.isFinite(Number(goalsRaw.carbsG)) ? Math.round(Number(goalsRaw.carbsG)) : undefined,
        fatG: Number.isFinite(Number(goalsRaw.fatG)) ? Math.round(Number(goalsRaw.fatG)) : undefined,
        waterMl: Number.isFinite(Number(goalsRaw.waterMl)) ? Math.round(Number(goalsRaw.waterMl)) : undefined,
      }
    : undefined;

  return {
    name: typeof row.name === 'string' && row.name.trim() ? row.name.trim() : 'Imported Nutrition Plan',
    goals,
    days,
  };
}

/** Heuristic fallback when OpenAI is unavailable — best-effort day/exercise extraction. */
export function heuristicParseProgramText(text: string, kind: ImportKind): ProgramImportPreview {
  const warnings: string[] = ['Parsed without AI — review carefully before applying.'];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const workoutDays: CycleProgramInput['days'] = [];
  let current: { label: string; isRest: boolean; exercises: CycleTemplateExercise[] } | null = null;

  const dayRe = /^(?:day\s*(\d+)|workout\s*(\d+)|week\s*\d+\s*[-–]?\s*day\s*(\d+)|(.*)\s+day)\b[:.\-–]?\s*(.*)?$/i;
  const restRe = /\brest\b/i;
  const exRe =
    /^[-•*]?\s*(.+?)\s*[-–:]?\s*(\d+)\s*[x×]\s*(\d+(?:\s*[-–]\s*\d+)?)\s*(?:reps?)?\b/i;
  const setsRepsRe = /^[-•*]?\s*(.+?)\s+(\d+)\s*sets?\s*(?:of\s*)?(\d+(?:\s*[-–]\s*\d+)?)/i;

  const flush = () => {
    if (current) workoutDays.push(current);
    current = null;
  };

  for (const line of lines) {
    const dayMatch = line.match(dayRe);
    if (dayMatch && (dayMatch[1] || dayMatch[2] || dayMatch[3] || /day/i.test(line))) {
      flush();
      const n = dayMatch[1] || dayMatch[2] || dayMatch[3];
      const labelTail = (dayMatch[5] || dayMatch[4] || '').trim();
      const label = n ? `Day ${n}${labelTail ? ` — ${labelTail}` : ''}` : line.slice(0, 48);
      const isRest = restRe.test(line) && !exRe.test(line);
      current = { label, isRest, exercises: [] };
      continue;
    }
    if (!current) continue;
    if (restRe.test(line) && line.length < 40) {
      current.isRest = true;
      continue;
    }
    const ex = line.match(exRe) || line.match(setsRepsRe);
    if (ex) {
      current.isRest = false;
      current.exercises.push({
        name: ex[1].trim(),
        exerciseName: ex[1].trim(),
        sets: Math.max(1, Number(ex[2]) || 3),
        reps: String(ex[3]).replace(/\s+/g, ''),
        repRange: String(ex[3]).replace(/\s+/g, ''),
      });
    }
  }
  flush();

  let workout: CycleProgramInput | null = null;
  if (kind !== 'nutrition' && workoutDays.length > 0) {
    const lengthDays = clampCycleLength(Math.max(workoutDays.length, CYCLE_MIN_DAYS));
    while (workoutDays.length < lengthDays) {
      workoutDays.push({ label: `Day ${workoutDays.length + 1} Rest`, isRest: true, exercises: [] });
    }
    workout = {
      name: 'Imported Workout Program',
      lengthDays,
      days: workoutDays.slice(0, lengthDays),
    };
  } else if (kind !== 'nutrition') {
    warnings.push('No workout days detected.');
  }

  // Nutrition heuristic: look for "calories" / "protein" goals only — meals need clearer structure.
  let nutrition: ImportedNutritionPlan | null = null;
  if (kind !== 'workout') {
    const cal = text.match(/(\d{3,4})\s*(?:kcal|calories)\b/i);
    const pro = text.match(/(\d{2,3})\s*g?\s*protein\b/i);
    if (cal || pro) {
      nutrition = {
        name: 'Imported Nutrition Targets',
        goals: {
          calories: cal ? Number(cal[1]) : undefined,
          proteinG: pro ? Number(pro[1]) : undefined,
        },
        days: [],
      };
      warnings.push(
        'Detected nutrition targets but not full meal rows. Apply will set goals; add meals from Nutrition if needed, or use AI parse when available.',
      );
    } else {
      warnings.push('No nutrition plan detected.');
    }
  }

  if (kind === 'nutrition') workout = null;
  if (kind === 'workout') nutrition = null;

  const summaryParts: string[] = [];
  if (workout) {
    const liftDays = workout.days.filter((d) => !d.isRest).length;
    summaryParts.push(`${workout.lengthDays}-day workout cycle (${liftDays} training days)`);
  }
  if (nutrition?.goals?.calories || nutrition?.goals?.proteinG) {
    summaryParts.push(
      `Nutrition targets${nutrition.goals?.calories ? ` · ${nutrition.goals.calories} kcal` : ''}${
        nutrition.goals?.proteinG ? ` · ${nutrition.goals.proteinG}g protein` : ''
      }`,
    );
  }

  return {
    kind,
    title: workout?.name ?? nutrition?.name ?? 'Imported plan',
    summary: summaryParts.join(' · ') || 'Could not extract a usable plan',
    workout,
    nutrition: nutrition && (nutrition.days.length > 0 || nutrition.goals) ? nutrition : null,
    warnings,
  };
}

type LlmShape = {
  title?: string;
  summary?: string;
  workout?: unknown;
  nutrition?: unknown;
  warnings?: string[];
};

export async function parseProgramDocument(options: {
  text: string;
  kind: ImportKind;
  fileName?: string;
}): Promise<ProgramImportPreview> {
  const { text, kind, fileName } = options;

  if (hasOpenAI()) {
    const system = `You extract workout programs and/or nutrition meal plans from user-supplied document text.
Return JSON only with keys: title, summary, workout, nutrition, warnings (string array).
workout is null or { name, lengthDays (1-30), days: [{ label, isRest, exercises: [{ name, sets, reps, restSeconds, weightLbs, notes }] }] }.
Use day-based cycles (Day 1..N), not calendar weeks. Mark rest days with isRest true and empty exercises.
nutrition is null or { name, goals: { calories, proteinG, carbsG, fatG, waterMl }, days: [{ dayIndex 0=Mon..6=Sun, label, meals: [{ mealType, name, scheduledTime, calories, proteinG, carbsG, fatG, notes }] }] }.
mealType must be one of breakfast|lunch|dinner|snack|pre_workout|post_workout.
Only include workout and/or nutrition matching the requested kind ("${kind}"). Omit inventing meals/exercises not supported by the text — prefer fewer accurate items.
If the document is only goals without meals, return goals and empty days.`;

    const user = [
      `Requested kind: ${kind}`,
      fileName ? `File name: ${fileName}` : null,
      asPromptData('PROGRAM_DOCUMENT_TEXT', text),
    ]
      .filter(Boolean)
      .join('\n\n');

    const llm = await chatCompletionJson<LlmShape>({
      system,
      user,
      temperature: 0.1,
      maxTokens: 4000,
    });

    if (llm) {
      const workout = kind === 'nutrition' ? null : sanitizeWorkout(llm.workout);
      const nutrition = kind === 'workout' ? null : sanitizeNutrition(llm.nutrition);
      const warnings = Array.isArray(llm.warnings)
        ? llm.warnings.filter((w): w is string => typeof w === 'string')
        : [];
      if (kind !== 'nutrition' && !workout) warnings.push('No workout program found in document.');
      if (kind !== 'workout' && !nutrition) warnings.push('No nutrition plan found in document.');
      return {
        kind,
        title: typeof llm.title === 'string' ? llm.title : workout?.name ?? nutrition?.name,
        summary:
          typeof llm.summary === 'string' && llm.summary.trim()
            ? llm.summary.trim()
            : [
                workout
                  ? `${workout.lengthDays}-day cycle · ${workout.days.filter((d) => !d.isRest).length} training days`
                  : null,
                nutrition ? `${nutrition.days.reduce((n, d) => n + d.meals.length, 0)} meals` : null,
              ]
                .filter(Boolean)
                .join(' · ') || 'Parsed document',
        workout,
        nutrition,
        warnings,
      };
    }
  }

  return heuristicParseProgramText(text, kind);
}
