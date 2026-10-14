import { formatWeight } from '@/lib/unitConversion';
import type { WorkoutSession, WorkoutSet } from '@/types';
import type { WeightUnit } from '@/types/common';

const LB_PER_KG = 2.2046226218;

export type WorkoutHistoryReportOptions = {
  weightUnit: WeightUnit;
  /** IANA zone the user lives in, so a late-evening session lands on the day they remember. */
  timeZone?: string;
  generatedAt?: Date;
  /** Shown under the title, e.g. the account name. */
  athleteName?: string;
};

export type WorkoutHistoryTotals = {
  sessions: number;
  sets: number;
  volumeKg: number;
  personalRecords: number;
  firstSessionAt?: string;
  lastSessionAt?: string;
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(iso: string, timeZone?: string, withWeekday = false): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(withWeekday ? { weekday: 'short' as const } : {}),
  };
  try {
    return date.toLocaleDateString('en-US', { ...options, timeZone });
  } catch {
    return date.toLocaleDateString('en-US', options);
  }
}

export function formatReportDuration(seconds?: number): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

function formatVolume(kg: number, unit: WeightUnit): string {
  if (kg <= 0) return '0';
  const value = unit === 'lb' ? kg * LB_PER_KG : kg;
  return `${Math.round(value).toLocaleString('en-US')} ${unit}`;
}

/** One logged set as it reads on paper: "135 lb × 8", "20 reps", "60s hold". */
export function formatReportSet(set: WorkoutSet, unit: WeightUnit): string {
  const hasLoad = set.weight != null && set.weight > 0;
  const hasReps = set.reps != null && set.reps > 0;
  const hasDuration = set.durationSeconds != null && set.durationSeconds > 0;

  let text: string;
  if (hasLoad && hasReps) text = `${formatWeight(set.weight, unit)} × ${set.reps}`;
  else if (hasReps) text = `${set.reps} reps`;
  else if (hasDuration && hasLoad) text = `${formatWeight(set.weight, unit)} · ${set.durationSeconds}s`;
  else if (hasDuration) text = `${set.durationSeconds}s`;
  else if (hasLoad) text = formatWeight(set.weight, unit);
  else text = '—';

  return set.isPr ? `${text} ★` : text;
}

export function summarizeWorkoutHistory(sessions: WorkoutSession[]): WorkoutHistoryTotals {
  let sets = 0;
  let volumeKg = 0;
  let personalRecords = 0;
  const times: string[] = [];

  for (const session of sessions) {
    times.push(session.startedAt);
    for (const exercise of session.exercises) {
      for (const set of exercise.sets) {
        sets += 1;
        if (set.weight && set.reps) volumeKg += set.weight * set.reps;
        if (set.isPr) personalRecords += 1;
      }
    }
  }

  times.sort();
  return {
    sessions: sessions.length,
    sets,
    volumeKg,
    personalRecords,
    firstSessionAt: times[0],
    lastSessionAt: times[times.length - 1],
  };
}

function sessionBlock(session: WorkoutSession, options: WorkoutHistoryReportOptions): string {
  const exercises = [...session.exercises]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .filter((exercise) => exercise.sets.length > 0);

  const setCount = exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  const volumeKg = exercises.reduce(
    (sum, exercise) =>
      sum + exercise.sets.reduce((inner, set) => inner + (set.weight && set.reps ? set.weight * set.reps : 0), 0),
    0,
  );

  const meta = [
    formatReportDuration(session.durationSeconds),
    `${setCount} ${setCount === 1 ? 'set' : 'sets'}`,
    volumeKg > 0 ? `${formatVolume(volumeKg, options.weightUnit)} volume` : '',
  ].filter(Boolean);

  const rows = exercises
    .map((exercise) => {
      const sets = [...exercise.sets]
        .sort((a, b) => a.setNumber - b.setNumber)
        .map((set) => escapeHtml(formatReportSet(set, options.weightUnit)))
        .join('<span class="sep">  |  </span>');
      const name = escapeHtml(exercise.exercise?.name ?? 'Exercise');
      return `<tr><td class="ex">${name}</td><td class="sets">${sets}</td></tr>`;
    })
    .join('');

  const body = rows
    ? `<table>${rows}</table>`
    : '<p class="empty">No sets were logged in this session.</p>';

  return `<section class="session">
  <div class="session-head">
    <div><span class="date">${escapeHtml(formatDate(session.startedAt, options.timeZone, true))}</span>
    <span class="name">${escapeHtml(session.name || 'Workout')}</span></div>
    <div class="meta">${escapeHtml(meta.join(' · '))}</div>
  </div>
  ${body}
</section>`;
}

const STYLES = `
  @page { margin: 36px 40px; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #111; font-size: 12px; line-height: 1.4; }
  h1 { font-size: 26px; margin: 0 0 2px; }
  .sub { color: #666; margin-bottom: 18px; }
  .totals { display: flex; gap: 10px; margin-bottom: 22px; }
  .tile { flex: 1; border: 1px solid #ddd; border-radius: 8px; padding: 10px 12px; }
  .tile .v { font-size: 20px; font-weight: 700; }
  .tile .l { color: #666; font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; }
  .session { margin-bottom: 16px; break-inside: avoid; page-break-inside: avoid; }
  .session-head { display: flex; justify-content: space-between; align-items: baseline;
    border-bottom: 2px solid #111; padding-bottom: 3px; margin-bottom: 4px; }
  .date { font-weight: 700; margin-right: 8px; }
  .name { color: #333; }
  .meta { color: #666; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 3px 0; border-bottom: 1px solid #eee; vertical-align: top; }
  td.ex { width: 32%; font-weight: 600; padding-right: 10px; }
  td.sets { color: #222; }
  .sep { color: #bbb; }
  .empty { color: #888; margin: 4px 0; }
  .foot { color: #888; font-size: 10px; margin-top: 18px; }
`;

/** A self-contained HTML document of every session, newest first, ready for expo-print. */
export function buildWorkoutHistoryHtml(
  sessions: WorkoutSession[],
  options: WorkoutHistoryReportOptions,
): string {
  const ordered = [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const totals = summarizeWorkoutHistory(ordered);
  const generatedAt = options.generatedAt ?? new Date();

  const range =
    totals.firstSessionAt && totals.lastSessionAt
      ? `${formatDate(totals.firstSessionAt, options.timeZone)} – ${formatDate(totals.lastSessionAt, options.timeZone)}`
      : 'No sessions yet';

  const tiles = [
    ['Sessions', String(totals.sessions)],
    ['Sets logged', totals.sets.toLocaleString('en-US')],
    ['Total volume', formatVolume(totals.volumeKg, options.weightUnit)],
    ['Personal records', String(totals.personalRecords)],
  ]
    .map(([label, value]) => `<div class="tile"><div class="v">${escapeHtml(value)}</div><div class="l">${label}</div></div>`)
    .join('');

  const sessionsHtml = ordered.length
    ? ordered.map((session) => sessionBlock(session, options)).join('\n')
    : '<p class="empty">No completed workouts to show.</p>';

  const who = options.athleteName ? `${escapeHtml(options.athleteName)} · ` : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><style>${STYLES}</style></head>
<body>
  <h1>Workout history</h1>
  <div class="sub">${who}${escapeHtml(range)} · Generated ${escapeHtml(formatDate(generatedAt.toISOString(), options.timeZone))}</div>
  <div class="totals">${tiles}</div>
  ${sessionsHtml}
  <div class="foot">★ marks a personal record. Weights shown in ${options.weightUnit}. Apple Fitness cardio imports are not included.</div>
</body>
</html>`;
}
