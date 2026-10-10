/**
 * Turn extracted PDF / pasted plan text into a structured workout cycle and/or nutrition week
 * that can be committed into existing sinks (custom_cycle + meal_plans/meals).
 */

import { asPromptData, chatCompletionJsonResult, hasOpenAI, type ChatFailureReason } from './openai.js';
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

function positiveInt(value: unknown, max: number): number | undefined {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return undefined;
  return Math.min(Math.round(numeric), max);
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
    const label =
      typeof d.label === 'string' && d.label.trim()
        ? d.label.trim()
        : isRest
          ? `Day ${index + 1} Rest`
          : `Day ${index + 1}`;
    // Trust the model's own mode when it gives a usable one; otherwise read the label, which is
    // where a protocol most often survives ("Day 4 — Tabata Finisher").
    const declared = detectExecutionHint(String(d.executionMode ?? '')) ?? {};
    const hint = executionHintForDay(
      mergeExecutionHint(
        {
          executionMode: declared.executionMode,
          intervalWorkSeconds: positiveInt(d.intervalWorkSeconds, 600),
          intervalRestSeconds: positiveInt(d.intervalRestSeconds, 600),
          intervalRounds: positiveInt(d.intervalRounds, 30),
        },
        detectExecutionHint(label) ?? {},
      ),
    );
    return {
      label,
      isRest: isRest || exercises.length === 0,
      exercises,
      ...(isRest ? {} : hint),
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

/**
 * A bare weekday only starts a day when the line reads like a heading.
 *
 * "Day 3" and "Workout 2" are headings and nothing else, but a weekday is an ordinary English
 * word, so every sentence that opens with one was being taken for the start of a training day.
 * A real plan says "Saturday, October 10, in the order you listed." and "Friday as recovery time;
 * do not try to make up missed volume" in its opening prose, and both were read as days — leaving
 * the import with three empty days before the workout, Day 1 shown as Rest, and the actual
 * sessions pushed down the cycle.
 *
 * A heading is short and has no sentence in it. That is enough to separate "SATURDAY | A: CHEST +
 * TRICEPS" from a paragraph that happens to begin on a weekday, without demanding a particular
 * capitalisation or separator that a hand-written plan may not use.
 */
const HEADING_MAX_LENGTH = 60;
const SENTENCE_PUNCTUATION_RE = /[.;]/;

function looksLikeHeading(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.length <= HEADING_MAX_LENGTH && !SENTENCE_PUNCTUATION_RE.test(trimmed);
}

/**
 * Template-letter days: "A | Chest + triceps", "B | Back + biceps".
 *
 * Plans built around rotating templates name their days by letter rather than by number, and
 * those headings were invisible here — so a document whose workouts were all under A–F had no
 * day the parser could see, and the import fell back to whatever else in the file happened to
 * look like a day.
 *
 * The pipe is required. A letter alone opens far too many ordinary lines, and the same plan
 * usually also lists "A: Chest/triceps" in a calendar at the top, which is a reference to the
 * day rather than the day itself.
 */
const LETTER_DAY_HEADER_RE = /^(?:day\s+)?([a-h])\s*\|\s*(.+)$/i;

function parseDayHeader(line: string): { dayNumber: number | null; labelTail: string; focus: string; isRest: boolean } | null {
  const match = line.match(DAY_HEADER_RE);
  if (!match) return parseLetterDayHeader(line);
  // Group 6 is the bare-weekday branch — the only one a sentence can open with by accident.
  if (match[6] && !looksLikeHeading(line)) return null;
  const n =
    match[1] ||
    (match[2] ? String(WORD_DAY[match[2].toLowerCase()] ?? '') : '') ||
    match[3] ||
    match[4] ||
    match[5] ||
    (match[6] ? String(WORD_DAY[match[6].toLowerCase()] ?? '') : '');
  const dayNumber = n && Number.isFinite(Number(n)) ? Number(n) : null;
  return describeDayHeader(line, dayNumber, match[7] ?? '');
}

/**
 * A letter day carries no number, so the heading itself becomes the label. "A | Chest + triceps"
 * tells the lifter which template they are looking at; "Day 1" would tell them less.
 */
function parseLetterDayHeader(line: string): ReturnType<typeof parseDayHeader> {
  if (!looksLikeHeading(line)) return null;
  const match = line.match(LETTER_DAY_HEADER_RE);
  if (!match) return null;
  return describeDayHeader(line, null, match[2]);
}

function describeDayHeader(
  line: string,
  dayNumber: number | null,
  rawTail: string,
): { dayNumber: number | null; labelTail: string; focus: string; isRest: boolean } {
  let labelTail = rawTail.trim().replace(/^[—–\-:|\s]+/, '');
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

export type DayExecutionHint = {
  executionMode?: string;
  intervalWorkSeconds?: number;
  intervalRestSeconds?: number;
  intervalRounds?: number;
};

const MODE_MARKERS: Array<{ re: RegExp; mode: string }> = [
  { re: /\btabata\b/i, mode: 'tabata' },
  { re: /\bhiit\b/i, mode: 'hiit' },
  { re: /\bhigh[-\s]?intensity\s+interval/i, mode: 'hiit' },
  { re: /\bintervals?\s+(?:training|day|session)\b/i, mode: 'hiit' },
  { re: /\bcircuits?\b/i, mode: 'circuit' },
];

/**
 * "20s on / 10s off", "20 sec work, 10 sec rest", "30 seconds on 15 seconds off". Requires the
 * on/off or work/rest wording: a bare "20/10" in a training document is far more likely to be a
 * date, a percentage or a rep scheme than an interval.
 */
const WORK_REST_RE =
  /(\d{1,3})\s*(?:s|sec|secs|second|seconds)?\s*(?:on|work(?:ing)?)\b[\s,;/·—–-]*(\d{1,3})\s*(?:s|sec|secs|second|seconds)?\s*(?:off|rest)\b/i;

const ROUNDS_RE = /(?:[x×]\s*)?(\d{1,2})\s*(?:rounds?|intervals?)\b/i;

/**
 * Read how a day is meant to be run out of a line of the document.
 *
 * A plan that says "Day 4 — Tabata: 20s on / 10s off × 8" is asking for the interval timer, not
 * for straight sets. Without this the import had no way to express that and every imported day
 * became traditional.
 */
export function detectExecutionHint(line: string): DayExecutionHint | null {
  const hint: DayExecutionHint = {};

  for (const marker of MODE_MARKERS) {
    if (marker.re.test(line)) {
      hint.executionMode = marker.mode;
      break;
    }
  }

  const workRest = line.match(WORK_REST_RE);
  if (workRest) {
    const work = Number(workRest[1]);
    const rest = Number(workRest[2]);
    if (work > 0 && work <= 600 && rest > 0 && rest <= 600) {
      hint.intervalWorkSeconds = work;
      hint.intervalRestSeconds = rest;
      // Work/rest wording without a named protocol is still interval training.
      hint.executionMode = hint.executionMode ?? 'hiit';
    }
  }

  // Rounds alone never implies a mode — "3 rounds" is how plenty of straight-set circuits of
  // accessories are written — so only read it once something else established one.
  if (hint.executionMode && hint.executionMode !== 'traditional') {
    const rounds = line.match(ROUNDS_RE);
    if (rounds) {
      const value = Number(rounds[1]);
      if (value > 0 && value <= 30) hint.intervalRounds = value;
    }
  }

  return Object.keys(hint).length > 0 ? hint : null;
}

/** Later lines fill gaps left by the day header without overwriting what it already said. */
export function mergeExecutionHint(base: DayExecutionHint, next: DayExecutionHint): DayExecutionHint {
  return {
    executionMode: base.executionMode ?? next.executionMode,
    intervalWorkSeconds: base.intervalWorkSeconds ?? next.intervalWorkSeconds,
    intervalRestSeconds: base.intervalRestSeconds ?? next.intervalRestSeconds,
    intervalRounds: base.intervalRounds ?? next.intervalRounds,
  };
}

/** Interval timings belong only to a mode that runs on a clock. */
export function executionHintForDay(hint: DayExecutionHint): DayExecutionHint {
  if (!hint.executionMode || hint.executionMode === 'traditional') return {};
  if (hint.executionMode !== 'tabata' && hint.executionMode !== 'hiit') {
    return { executionMode: hint.executionMode };
  }
  return hint;
}

/**
 * A prescription written on its own line, under the exercise it belongs to.
 *
 * Plenty of plans lay an exercise out over two lines — the lift on one, "Sets x reps: 2 x 6-12"
 * on the next. Read a line at a time, the second line looks like an exercise whose name is "Sets
 * x reps", so a seven-exercise day imported as seven copies of that phrase and the lift names
 * were thrown away entirely.
 */
const PRESCRIPTION_LABEL_RE =
  /^(?:sets?|reps?|volume|prescription)(?:\s*(?:[x×/&+,-]|and)\s*(?:sets?|reps?))?\s*[:–—-]\s*/i;
const PRESCRIPTION_BODY_RE =
  /^(\d+)\s*(?:[x×]\s*|sets?\s*(?:of\s*|x\s*|×\s*)?)(\d+(?:\s*[-–]\s*\d+)?)\s*(?:reps?)?\b(.*)$/i;
/** What may follow the numbers on a line that is still only a prescription. */
const PRESCRIPTION_TAIL_RE = /^(?:reps?\b|each\b|per\b|total\b|[)\],.\-–—]|$)/i;

function parsePrescriptionOnlyLine(line: string): { sets: number; reps: string } | null {
  const label = line.match(PRESCRIPTION_LABEL_RE);
  const body = (label ? line.slice(label[0].length) : line).trim();
  const match = body.match(PRESCRIPTION_BODY_RE);
  if (!match) return null;
  // Unlabelled, only a line that is nothing but the prescription counts. Otherwise
  // "3 x 10 Bulgarian split squats" would be read as a prescription for the line above it.
  if (!label && !PRESCRIPTION_TAIL_RE.test(match[3].trim())) return null;
  const sets = Number(match[1]);
  if (!Number.isFinite(sets) || sets < 1) return null;
  return { sets: Math.min(sets, 20), reps: match[2].replace(/\s+/g, '') };
}

/**
 * Whether a line could be the name of the lift that a following prescription line describes.
 *
 * Between the lifts a plan carries coaching prose — "Technique: feet on stable bench; keep hips
 * level." — and none of it should end up named as an exercise. A lift name is short, has no
 * sentence in it, and does not read as a labelled note.
 */
const ORDINAL_PREFIX_RE = /^\(?\d{1,2}[.)\]]\s+/;
const EXERCISE_NAME_MAX_LENGTH = 70;
const PAGE_NUMBER_ONLY_RE = /^\d{1,3}$/;

function cleanExerciseName(raw: string): string {
  return raw.trim().replace(ORDINAL_PREFIX_RE, '').replace(/^[-•*]\s*/, '').trim();
}

/** Headings a plan carries between its lifts. None of them is the name of one. */
const NON_EXERCISE_HEADING_RE =
  /^(?:warm[-\s]?ups?|cool[-\s]?downs?|progression|notes?|technique|form|setup|substitutions?|equipment)\b/i;

function exerciseNameCandidate(line: string): string | null {
  const trimmed = cleanExerciseName(line);
  if (!trimmed || trimmed.length > EXERCISE_NAME_MAX_LENGTH) return null;
  if (SENTENCE_PUNCTUATION_RE.test(trimmed) || trimmed.includes(':')) return null;
  if (!/[a-z]/i.test(trimmed)) return null;
  if (NON_EXERCISE_HEADING_RE.test(trimmed)) return null;
  return trimmed;
}

/**
 * A lift name wrapped onto a second line.
 *
 * A plan laid out as a table comes out of a PDF with its columns flattened and its longer names
 * broken mid-phrase — "5. Standing underhand dumbbell" on one line, "fly" on the next — so
 * taking only the line above the prescription imported that exercise as "fly". A fragment that
 * opens in lower case and is too short to be a name of its own is the tail of the line before it.
 */
const WRAPPED_NAME_MAX_LENGTH = 25;

function joinWrappedName(pending: string | null, candidate: string, line: string): string {
  const trimmed = line.trim();
  if (!pending || trimmed.length > WRAPPED_NAME_MAX_LENGTH || !/^[a-z]/.test(trimmed)) {
    return candidate;
  }
  const joined = `${pending} ${candidate}`;
  return joined.length <= EXERCISE_NAME_MAX_LENGTH ? joined : candidate;
}

function parseExerciseLine(line: string): CycleTemplateExercise | null {
  const ex = line.match(EX_RE) || line.match(SETS_REPS_RE);
  if (ex) {
    const name = cleanExerciseName(ex[1]);
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
    // The loosest of the three patterns, and the one coaching prose falls into: "Week 4: perform
    // 1 set per exercise." was being imported as a lift called "Week 4: perform". Asking that the
    // name read like a lift name costs nothing that "Plank 3 sets" would not still pass.
    const name = exerciseNameCandidate(setsOnly[1]);
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

/** The heuristic's note about itself, rewritten by the caller once it knows what the AI did. */
const NO_AI_WARNING = 'Parsed without AI — review carefully before applying.';

/** A day as the document lays it out: what was read from it, beside the lines it was read from. */
type DocumentDay = { day: CycleProgramInput['days'][number]; label: string; text: string };

/**
 * Whether a parsed day is this document's account of a training day.
 *
 * A plan states its days more than once — a calendar at the top, the sessions themselves, then a
 * meal plan keyed by the same days at the bottom — and only one of those listings is the workout.
 * The others carry no exercises, and neither does a banner heading sitting above the real one
 * ("B | BACK + BICEPS" immediately above "B | Back and biceps"). A day that says it is a rest day
 * is kept on its word, since having nothing in it is the whole point.
 */
function describesTraining(day: CycleProgramInput['days'][number]): boolean {
  return Boolean(day.isRest) || (day.exercises?.length ?? 0) > 0;
}

/**
 * Cut a document into its days and read each one.
 *
 * The heuristic parse and the day-at-a-time AI read both work from this. They merge their results
 * by position, so a day either of them dropped or split on its own would put the two out of step
 * and hand a lifter one day's exercises under another day's name.
 */
function readDocumentDays(text: string): {
  preamble: string[];
  days: DocumentDay[];
} {
  const lines = normalizePlanText(text).split('\n').filter(Boolean);

  const preamble: string[] = [];
  const days: DocumentDay[] = [];
  let current:
    | {
        label: string;
        isRest: boolean;
        exercises: CycleTemplateExercise[];
        hint: DayExecutionHint;
        lines: string[];
      }
    | null = null;

  // A protocol stated before the first day header ("This block is run Tabata style") applies to
  // the whole document rather than to one day.
  let documentHint: DayExecutionHint = {};

  // The lift name sits on the line above its "Sets x reps: 2 x 6-12" in plenty of plans, so the
  // last line that could be a name is held until the next line says whether it was one. A few
  // plans put the prescription first instead, so one with no name above it waits for the one
  // below rather than being thrown away.
  let pendingName: string | null = null;
  let pendingPrescription: { sets: number; reps: string } | null = null;

  const pushExercise = (name: string, prescription: { sets: number; reps: string }) => {
    if (!current) return;
    current.isRest = false;
    current.exercises.push({
      name,
      exerciseName: name,
      sets: prescription.sets,
      reps: prescription.reps,
      repRange: prescription.reps,
      restSeconds: DEFAULT_IMPORT_REST_SECONDS,
    });
  };

  const flush = () => {
    if (current) {
      const { hint, lines: dayLines, label, ...rest } = current;
      days.push({
        day: { label, ...rest, ...executionHintForDay(mergeExecutionHint(hint, documentHint)) },
        label,
        text: dayLines.join('\n'),
      });
    }
    current = null;
    pendingName = null;
    pendingPrescription = null;
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
      current = {
        label,
        isRest: header.isRest,
        exercises: [],
        hint: detectExecutionHint(line) ?? {},
        lines: [line],
      };

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
    if (!current) {
      const hint = detectExecutionHint(line);
      if (hint) documentHint = mergeExecutionHint(documentHint, hint);
      if (line.trim()) preamble.push(line);
      continue;
    }
    current.lines.push(line);
    // A page number stranded mid-exercise by the extractor. It carries nothing, and letting it
    // count as a line lost every lift whose prescription happened to fall after a page break.
    if (PAGE_NUMBER_ONLY_RE.test(line.trim())) continue;

    // Tried before the one-line forms: "Sets x reps: 2 x 6-12" matches those too, as an exercise
    // called "Sets x reps".
    const prescription = parsePrescriptionOnlyLine(line);
    if (prescription) {
      if (pendingName) {
        pushExercise(pendingName, prescription);
        pendingName = null;
      } else {
        pendingPrescription = prescription;
      }
      continue;
    }

    const exercise = parseExerciseLine(line);
    // A protocol line is read before the rest-day check, so "Tabata: 20s on / 10s off" is not
    // mistaken for a rest day just because it contains the word "rest".
    if (!exercise) {
      const hint = detectExecutionHint(line);
      if (hint) {
        current.hint = mergeExecutionHint(current.hint, hint);
        continue;
      }
      // Only a day with nothing in it yet. "Rest 2-3 minutes between squat sets" is a line every
      // training day carries, and it was turning days with seven lifts in them into rest days.
      if (current.exercises.length === 0 && /\brest\b/i.test(line) && line.length < 40) {
        current.isRest = true;
      }
      const candidate = exerciseNameCandidate(line);
      if (candidate && pendingPrescription) {
        pushExercise(candidate, pendingPrescription);
        pendingPrescription = null;
        pendingName = null;
        continue;
      }
      pendingName = candidate ? joinWrappedName(pendingName, candidate, line) : null;
      continue;
    }
    current.isRest = false;
    current.exercises.push(exercise);
    pendingName = null;
    pendingPrescription = null;
  }
  flush();

  const training = days.filter((entry) => describesTraining(entry.day));
  return { preamble, days: training.length > 0 ? training : days };
}

/** Heuristic fallback when OpenAI is unavailable — best-effort day/exercise extraction. */
export function heuristicParseProgramText(text: string, kind: ImportKind): ProgramImportPreview {
  const warnings: string[] = [NO_AI_WARNING];
  const workoutDays = readDocumentDays(text).days.map((entry) => entry.day);

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

/**
 * How long the model gets to read a document.
 *
 * Reading a seven-day plan takes the model about fourteen seconds, so the old twenty-second
 * ceiling — the one meant for a sentence of coaching — left no room for a longer document or a
 * busy afternoon, and the import kept falling back to pattern-matching. The phone stops waiting
 * on a request of its own accord at about a minute, and extraction has already spent some of
 * that, so this is roughly what is left to give.
 */
export const MAX_AI_PARSE_MS = 40_000;

function replaceNoAiWarning(warnings: string[], replacement?: string): string[] {
  const rest = warnings.filter((warning) => warning !== NO_AI_WARNING);
  return replacement ? [replacement, ...rest] : rest;
}

/**
 * What to tell someone whose plan was read by pattern-matching after the AI read did not land.
 *
 * "Parsed without AI" said the outcome and not the cause, so a timeout that a second attempt would
 * have got through looked the same as having no AI at all.
 */
function aiUnavailableWarning(reason: ChatFailureReason): string {
  switch (reason) {
    case 'timeout':
      return (
        'The AI read of this plan took too long, so it was read by pattern-matching instead. ' +
        'Everything below is still yours to fix — or go back and read the plan again, which often gets through.'
      );
    case 'unparseable':
      return (
        'The AI read of this plan came back unusable, so it was read by pattern-matching instead. ' +
        'Check the days below before applying.'
      );
    case 'no_provider':
      return NO_AI_WARNING;
    default:
      return (
        'The AI read of this plan was unavailable, so it was read by pattern-matching instead. ' +
        'Check the days below before applying.'
      );
  }
}

/** The model's answer, or why there isn't one. Injectable so the fallbacks can be tested. */
export type AiDocumentRead =
  | { ok: true; data: LlmShape }
  | { ok: false; reason: ChatFailureReason };

/**
 * A document cut into the days it describes, keyed on the same headers the heuristic walks.
 *
 * `preamble` is whatever sits above the first day — a plan title, a note on how the block is
 * run — and is prepended to each day so a protocol stated once is not lost by the split.
 */
export type DaySection = { label: string; text: string };

export function splitDocumentIntoDaySections(text: string): {
  preamble: string;
  days: DaySection[];
} {
  const read = readDocumentDays(text);
  return {
    preamble: read.preamble.join('\n'),
    days: read.days.map((entry) => ({ label: entry.label, text: entry.text })),
  };
}

/**
 * Below this, one read of the whole document is cheaper than a request per day.
 *
 * The cost that matters is the JSON the model has to write out. A three-day plan is a few
 * hundred tokens and lands well inside any budget; it is the long plans that do not, and they
 * are exactly the ones worth splitting.
 */
const AI_PER_DAY_MIN_SECTIONS = 4;

/**
 * How many day reads may be in flight at once.
 *
 * A cycle can run to thirty days, and firing thirty requests together trades a timeout for a
 * rate limit. Six keeps even the longest plan to a handful of waves while still collapsing most
 * of the wall clock a day-by-day read would otherwise spend in sequence.
 */
const AI_PER_DAY_CONCURRENCY = 6;

/** Map over `items` with at most `limit` promises in flight, preserving input order. */
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (let index = next++; index < items.length; index = next++) {
      results[index] = await fn(items[index]!, index);
    }
  });

  await Promise.all(workers);
  return results;
}

/**
 * Read a long plan a day at a time, concurrently.
 *
 * A ten-day plan with forty-four exercises is several thousand tokens of JSON, and generating it
 * is most of what the import spends — long enough that the read was timing out and the plan fell
 * back to pattern-matching. Asking per day turns one long generation into a set of short ones
 * that run together, so the wall clock is roughly the slowest single day rather than the sum.
 *
 * A day the model declines or mangles is left to the heuristic rather than failing the import,
 * so one bad day cannot cost the other nine.
 */
async function readDaysInParallel(
  sections: DaySection[],
  preamble: string,
  readWithAi: (prompt: { system: string; user: string }) => Promise<AiDocumentRead>,
): Promise<{ days: (unknown | null)[]; failed: number }> {
  const system = `You extract ONE day of a workout program from user-supplied document text.
Return JSON only: { "day": { "label", "isRest", "executionMode", "intervalWorkSeconds", "intervalRestSeconds", "intervalRounds", "exercises": [{ "name", "sets", "reps", "restSeconds", "weightLbs", "notes" }] } }.
Return every exercise the day lists, in order, and nothing that is not in the text.
Mark a rest day with isRest true and an empty exercises array.
Default restSeconds to 90 when the day does not say.
executionMode is how the day is run: omit it for ordinary straight sets, or use tabata|hiit|circuit when the text says so. Set intervalWorkSeconds, intervalRestSeconds and intervalRounds only from timings the text states — "20s on / 10s off x 8" is 20, 10, 8.`;

  const days = await mapWithConcurrency(sections, AI_PER_DAY_CONCURRENCY, async (section) => {
    const user = [
      preamble ? asPromptData('PLAN_CONTEXT', preamble) : null,
      asPromptData('DAY_TEXT', section.text),
    ]
      .filter(Boolean)
      .join('\n\n');

    const attempt = await readWithAi({ system, user });
    if (!attempt.ok) return null;
    return (attempt.data as { day?: unknown } | null)?.day ?? null;
  });

  return { days, failed: days.filter((day) => day == null).length };
}

/** The meal plan on its own, for when the workout half is being read a day at a time. */
async function readNutritionOnly(
  text: string,
  readWithAi: (prompt: { system: string; user: string }) => Promise<AiDocumentRead>,
): Promise<ImportedNutritionPlan | null> {
  const system = `You extract ONLY the nutrition plan from user-supplied document text. Ignore the workout.
Return JSON only: { "nutrition": null or { "name", "goals": { "calories", "proteinG", "carbsG", "fatG", "waterMl" }, "days": [{ "dayIndex" 0=Mon..6=Sun, "label", "meals": [{ "mealType", "name", "scheduledTime", "calories", "proteinG", "carbsG", "fatG", "notes" }] }] } }.
mealType must be one of breakfast|lunch|dinner|snack|pre_workout|post_workout.
If the document gives daily targets but no meals, return the goals and an empty days array.
Return null when the document says nothing about food. Do not invent meals or numbers.`;

  const attempt = await readWithAi({ system, user: asPromptData('PROGRAM_DOCUMENT_TEXT', text) });
  if (!attempt.ok) return null;
  return sanitizeNutrition((attempt.data as { nutrition?: unknown } | null)?.nutrition);
}

function readDocumentWithAi(
  prompt: { system: string; user: string },
  timeoutMs: number,
): Promise<AiDocumentRead> {
  return chatCompletionJsonResult<LlmShape>({
    ...prompt,
    temperature: 0.1,
    maxTokens: 8000,
    timeoutMs,
    // No retry: a second attempt would run past the phone's own patience, and an answer nobody is
    // still waiting for is no answer. The heuristic parse below is the better use of what is left.
    retries: 0,
  });
}

export async function parseProgramDocument(options: {
  text: string;
  kind: ImportKind;
  fileName?: string;
  /** What is left of the caller's own deadline. Capped at {@link MAX_AI_PARSE_MS}. */
  timeoutMs?: number;
  readWithAi?: (prompt: { system: string; user: string }) => Promise<AiDocumentRead>;
}): Promise<ProgramImportPreview> {
  const { kind, fileName } = options;
  const text = normalizePlanText(options.text);

  // Heuristic first so a collapsed 6-day paste always yields Days 1–N even when the model
  // under-fills or is unavailable. LLM can refine when it returns at least as many training days.
  const heuristic = heuristicParseProgramText(text, kind);

  if (options.readWithAi || hasOpenAI()) {
    const system = `You extract workout programs and/or nutrition meal plans from user-supplied document text.
Return JSON only with keys: title, summary, workout, nutrition, warnings (string array).
workout is null or { name, lengthDays (1-30), days: [{ label, isRest, executionMode, intervalWorkSeconds, intervalRestSeconds, intervalRounds, exercises: [{ name, sets, reps, restSeconds, weightLbs, notes }] }] }.
CRITICAL: Emit EVERY training day present in the document (Day 1, Day 2, …). Never collapse a 6-day plan into a single day. If the text lists six workouts, return six days with exercises.
Use day-based cycles (Day 1..N), not calendar weeks. Mark rest days with isRest true and empty exercises.
Default restSeconds to 90 when the document does not specify rest.
executionMode is how the day is run: omit it for ordinary straight sets, or use tabata|hiit|circuit when the document says so ("Tabata", "HIIT", "intervals", "circuit"). When the document gives interval timing, set intervalWorkSeconds, intervalRestSeconds and intervalRounds from it — "20s on / 10s off x 8" is 20, 10, 8. Never invent a mode or a timing the document does not state.
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

    const budget = Math.min(options.timeoutMs ?? MAX_AI_PARSE_MS, MAX_AI_PARSE_MS);
    const readWithAi = options.readWithAi ?? ((prompt) => readDocumentWithAi(prompt, budget));

    // A long plan is read a day at a time so no single generation has to carry the whole cycle.
    // Only the workout half splits this way; nutrition is short enough to ask for in one go.
    const sections = kind === 'nutrition' ? { preamble: '', days: [] } : splitDocumentIntoDaySections(text);
    if (sections.days.length >= AI_PER_DAY_MIN_SECTIONS) {
      // The meal plan rides along with the days rather than being skipped by the split. Its
      // output is short, so it costs no more wall clock than the day it runs beside.
      const [perDay, nutritionRead] = await Promise.all([
        readDaysInParallel(sections.days, sections.preamble, readWithAi),
        kind === 'workout' ? Promise.resolve(null) : readNutritionOnly(text, readWithAi),
      ]);

      // A day the model did not return keeps the heuristic's reading of that same day, so one
      // unread day costs its own detail rather than shifting every day after it up a slot.
      const merged = perDay.days.map((day, index) => day ?? heuristic.workout?.days[index] ?? null);
      const workout = sanitizeWorkout({ name: heuristic.workout?.name, days: merged.filter((day) => day != null) });

      if (workout && perDay.failed < sections.days.length) {
        const warnings = replaceNoAiWarning(heuristic.warnings);
        if (perDay.failed > 0) {
          warnings.push(
            `${perDay.failed} of ${sections.days.length} days could not be read by the AI and were kept as the document structured them. Check those days below.`,
          );
        }
        return {
          ...heuristic,
          workout,
          nutrition: nutritionRead ?? heuristic.nutrition,
          warnings,
        };
      }

      // Every day failed. Reading the whole document is unlikely to do better for the same
      // reason, so go straight to what the document structure gave us.
      return {
        ...heuristic,
        warnings: replaceNoAiWarning(heuristic.warnings, aiUnavailableWarning('timeout')),
      };
    }

    const attempt = await readWithAi({ system, user });

    if (!attempt.ok) {
      return {
        ...heuristic,
        warnings: replaceNoAiWarning(heuristic.warnings, aiUnavailableWarning(attempt.reason)),
      };
    }
    const llm = attempt.data;

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
          // The AI did run here — it just read fewer days than the document has — so the
          // heuristic's note about having run without it would be untrue.
          warnings: [...replaceNoAiWarning(heuristic.warnings), ...warnings],
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
