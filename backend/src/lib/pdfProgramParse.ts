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

/** Standard rest when a plan omits rest prescriptions. */
export const DEFAULT_IMPORT_REST_SECONDS = 90;

/**
 * PDF extractors and many paste boards collapse newlines into one long line. Day headers only
 * matched at line start, so "Day 1 … Day 2 … Day 6" became a single Day 1 with Days 2–6 stuck in
 * the label. Force a break before every day / workout / weekday marker so the heuristic (and the
 * model) see six separate days.
 */
export function normalizePlanText(raw: string): string {
  let text = (raw ?? '')
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\f/g, '\n');

  // Break before Day N / Workout N / Session N even when they sit mid-line.
  text = text.replace(
    /(?<![A-Za-z0-9])((?:day|workout|session|week)\s*\d+)\b/gi,
    '\n$1',
  );
  // Weekday headers common in PDF plans.
  text = text.replace(
    /(?<![A-Za-z0-9])(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
    '\n$1',
  );
  // "Day One" / "Day Two" style.
  text = text.replace(
    /(?<![A-Za-z0-9])(day\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve))\b/gi,
    '\n$1',
  );

  // After a completed sets×reps token, start a new line before the next Capitalized lift name.
  // Do NOT break inside multi-word names like "Bench Press 4x8".
  text = text.replace(
    /(\d+\s*[x×]\s*\d+(?:\s*[-–]\s*\d+)?(?:\s*reps?)?)\s+(?=[A-Z][A-Za-z])/g,
    '$1\n',
  );
  // "Walking Lunges 3x10 each Leg Curl …" — "each" blocks the capital-letter break above.
  text = text.replace(
    /(\d+\s*[x×]\s*\d+(?:\s*[-–]\s*\d+)?)\s+each\s+(?=[A-Z][A-Za-z])/gi,
    '$1 each\n',
  );
  text = text.replace(
    /(\d+\s*sets?(?:\s*(?:of|x|×)\s*\d+(?:\s*[-–]\s*\d+)?)?)\s+(?=[A-Z][A-Za-z])/g,
    '$1\n',
  );

  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

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
    const restRaw = Number(row.restSeconds);
    out.push({
      name,
      exerciseName: name,
      sets,
      reps,
      repRange: reps,
      restSeconds:
        Number.isFinite(restRaw) && restRaw > 0 ? Math.round(restRaw) : DEFAULT_IMPORT_REST_SECONDS,
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

  // Prefer the real parsed days — do not invent rest days from a claimed lengthDays that would
  // hide a truncated Day-1-only parse behind a fake 6-day cycle of mostly rest.
  const finalLength = clampCycleLength(Math.max(days.length, CYCLE_MIN_DAYS));

  const name = typeof row.name === 'string' && row.name.trim() ? row.name.trim() : undefined;
  return { name, lengthDays: finalLength, days: days.slice(0, finalLength) };
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

const WORD_DAY: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};

/** Match a day header anywhere in a line (not just ^) after normalization. */
const DAY_HEADER_RE =
  /^(?:day\s*(\d+)|day\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)|workout\s*(\d+)|session\s*(\d+)|week\s*\d+\s*[-–]?\s*day\s*(\d+)|(monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b[:.\-–]?\s*(.*)?$/i;

const EX_RE =
  /^[-•*]?\s*(.+?)\s*[-–:]?\s*(\d+)\s*[x×]\s*(\d+(?:\s*[-–]\s*\d+)?)\s*(?:reps?)?\b/i;
const SETS_REPS_RE =
  /^[-•*]?\s*(.+?)\s+(\d+)\s*sets?\s*(?:of\s*|x\s*|×\s*)?(\d+(?:\s*[-–]\s*\d+)?)/i;
const SETS_ONLY_RE = /^[-•*]?\s*(.+?)\s+(\d+)\s*sets?\b/i;

const DAY_FOCUS_RE =
  /^(push|pull|legs?|upper|lower|chest|back|shoulders?|arms?|full\s*body|rest|abs?|core)\b[:.\-–]?\s*/i;

function parseDayHeader(line: string): { dayNumber: number | null; labelTail: string; focus: string; isRest: boolean } | null {
  const match = line.match(DAY_HEADER_RE);
  if (!match) return null;
  const n =
    match[1] ||
    (match[2] ? String(WORD_DAY[match[2].toLowerCase()] ?? '') : '') ||
    match[3] ||
    match[4] ||
    match[5] ||
    (match[6] ? String(WORD_DAY[match[6].toLowerCase()] ?? '') : '');
  const dayNumber = n && Number.isFinite(Number(n)) ? Number(n) : null;
  let labelTail = (match[7] ?? '').trim().replace(/^[—–\-:\s]+/, '');
  let focus = '';
  const focusMatch = labelTail.match(DAY_FOCUS_RE);
  if (focusMatch) {
    focus = focusMatch[1].replace(/\s+/g, ' ');
    labelTail = labelTail.slice(focusMatch[0].length).trim();
  }
  const isRest =
    (/\brest\b/i.test(line) || /^rest$/i.test(focus)) &&
    !EX_RE.test(labelTail) &&
    !SETS_REPS_RE.test(labelTail);
  return { dayNumber, labelTail, focus, isRest };
}

function parseExerciseLine(line: string): CycleTemplateExercise | null {
  const ex = line.match(EX_RE) || line.match(SETS_REPS_RE);
  if (ex) {
    const name = ex[1].trim().replace(/^[-•*]\s*/, '');
    if (!name || /^(day|workout|session)\b/i.test(name)) return null;
    return {
      name,
      exerciseName: name,
      sets: Math.max(1, Number(ex[2]) || 3),
      reps: String(ex[3]).replace(/\s+/g, ''),
      repRange: String(ex[3]).replace(/\s+/g, ''),
      restSeconds: DEFAULT_IMPORT_REST_SECONDS,
    };
  }
  const setsOnly = line.match(SETS_ONLY_RE);
  if (setsOnly) {
    const name = setsOnly[1].trim().replace(/^[-•*]\s*/, '');
    if (!name || /^(day|workout|session)\b/i.test(name)) return null;
    return {
      name,
      exerciseName: name,
      sets: Math.max(1, Number(setsOnly[2]) || 3),
      restSeconds: DEFAULT_IMPORT_REST_SECONDS,
    };
  }
  return null;
}

/** Heuristic fallback when OpenAI is unavailable — best-effort day/exercise extraction. */
export function heuristicParseProgramText(text: string, kind: ImportKind): ProgramImportPreview {
  const warnings: string[] = ['Parsed without AI — review carefully before applying.'];
  const normalized = normalizePlanText(text);
  const lines = normalized.split('\n').filter(Boolean);

  const workoutDays: CycleProgramInput['days'] = [];
  let current: { label: string; isRest: boolean; exercises: CycleTemplateExercise[] } | null = null;

  const flush = () => {
    if (current) workoutDays.push(current);
    current = null;
  };

  for (const line of lines) {
    const header = parseDayHeader(line);
    if (header) {
      flush();
      const n = header.dayNumber;
      const focusLabel = header.focus
        ? header.focus.charAt(0).toUpperCase() + header.focus.slice(1).toLowerCase()
        : '';
      const label = n
        ? `Day ${n}${focusLabel ? ` — ${focusLabel}` : ''}`
        : line.slice(0, 48);
      current = { label, isRest: header.isRest, exercises: [] };

      // Same line may carry the first exercise after the header (collapsed paste).
      if (header.labelTail && !header.isRest) {
        const bits = header.labelTail
          .replace(/(\d+\s*[x×]\s*\d+(?:\s*[-–]\s*\d+)?)\s+(?=[A-Z])/g, '$1\n')
          .split('\n')
          .map((b) => b.trim())
          .filter(Boolean);
        for (const bit of bits) {
          const exercise = parseExerciseLine(bit);
          if (exercise) {
            current.isRest = false;
            current.exercises.push(exercise);
          }
        }
      }
      continue;
    }
    if (!current) continue;
    if (/\brest\b/i.test(line) && line.length < 40 && !parseExerciseLine(line)) {
      current.isRest = true;
      continue;
    }
    const exercise = parseExerciseLine(line);
    if (exercise) {
      current.isRest = false;
      current.exercises.push(exercise);
    }
  }
  flush();

  let workout: CycleProgramInput | null = null;
  if (kind !== 'nutrition' && workoutDays.length > 0) {
    const lengthDays = clampCycleLength(Math.max(workoutDays.length, CYCLE_MIN_DAYS));
    workout = {
      name: 'Imported Workout Program',
      lengthDays,
      days: workoutDays.slice(0, lengthDays),
    };
  } else if (kind !== 'nutrition') {
    warnings.push('No workout days detected.');
  }

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
    if (liftDays === 1 && workout.lengthDays > 1) {
      warnings.push(
        'Only one training day was detected. If your paste was one long line, try again — day headers are now split automatically.',
      );
    }
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
  const { kind, fileName } = options;
  const text = normalizePlanText(options.text);

  // Heuristic first so a collapsed 6-day paste always yields Days 1–N even when the model
  // under-fills or is unavailable. LLM can refine when it returns at least as many training days.
  const heuristic = heuristicParseProgramText(text, kind);

  if (hasOpenAI()) {
    const system = `You extract workout programs and/or nutrition meal plans from user-supplied document text.
Return JSON only with keys: title, summary, workout, nutrition, warnings (string array).
workout is null or { name, lengthDays (1-30), days: [{ label, isRest, exercises: [{ name, sets, reps, restSeconds, weightLbs, notes }] }] }.
CRITICAL: Emit EVERY training day present in the document (Day 1, Day 2, …). Never collapse a 6-day plan into a single day. If the text lists six workouts, return six days with exercises.
Use day-based cycles (Day 1..N), not calendar weeks. Mark rest days with isRest true and empty exercises.
Default restSeconds to 90 when the document does not specify rest.
nutrition is null or { name, goals: { calories, proteinG, carbsG, fatG, waterMl }, days: [{ dayIndex 0=Mon..6=Sun, label, meals: [{ mealType, name, scheduledTime, calories, proteinG, carbsG, fatG, notes }] }] }.
mealType must be one of breakfast|lunch|dinner|snack|pre_workout|post_workout.
Only include workout and/or nutrition matching the requested kind ("${kind}"). Do not invent exercises that are not in the text.
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
      maxTokens: 8000,
    });

    if (llm) {
      const workout = kind === 'nutrition' ? null : sanitizeWorkout(llm.workout);
      const nutrition = kind === 'workout' ? null : sanitizeNutrition(llm.nutrition);
      const warnings = Array.isArray(llm.warnings)
        ? llm.warnings.filter((w): w is string => typeof w === 'string')
        : [];

      const heuristicTraining = heuristic.workout?.days.filter((d) => !d.isRest).length ?? 0;
      const llmTraining = workout?.days.filter((d) => !d.isRest).length ?? 0;

      // Prefer the parse that recovered more training days — the model sometimes returns only Day 1.
      if (kind !== 'nutrition' && heuristicTraining > llmTraining) {
        warnings.push(
          `AI returned ${llmTraining} training day(s); kept the fuller ${heuristicTraining}-day parse from the document structure.`,
        );
        return {
          ...heuristic,
          warnings: [...heuristic.warnings, ...warnings],
          nutrition: nutrition ?? heuristic.nutrition,
        };
      }

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

  return heuristic;
}
