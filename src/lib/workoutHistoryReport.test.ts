import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildWorkoutHistoryHtml,
  escapeHtml,
  formatReportDuration,
  formatReportSet,
  summarizeWorkoutHistory,
} from './workoutHistoryReport';
import type { WorkoutSession, WorkoutSet } from '@/types';

function set(overrides: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    id: 's',
    workoutExerciseId: 'we',
    setNumber: 1,
    type: 'normal',
    loggedAt: '2026-10-01T15:00:00Z',
    createdAt: '2026-10-01T15:00:00Z',
    ...overrides,
  } as WorkoutSet;
}

function session(id: string, startedAt: string, name: string, sets: WorkoutSet[][]): WorkoutSession {
  return {
    id,
    userId: 'u',
    name,
    status: 'completed',
    startedAt,
    durationSeconds: 3_600,
    createdAt: startedAt,
    exercises: sets.map((exerciseSets, index) => ({
      id: `${id}-we-${index}`,
      sessionId: id,
      exerciseId: `ex-${index}`,
      exercise: { id: `ex-${index}`, name: `Lift ${index + 1}` },
      sortOrder: index,
      sets: exerciseSets,
      createdAt: startedAt,
    })),
  } as unknown as WorkoutSession;
}

test('a loaded set reads weight × reps in the chosen unit', () => {
  assert.equal(formatReportSet(set({ weight: 61.2331, reps: 8 }), 'lb'), '135 lb × 8');
  assert.equal(formatReportSet(set({ weight: 60, reps: 8 }), 'kg'), '60 kg × 8');
});

test('bodyweight and timed sets do not invent a weight', () => {
  assert.equal(formatReportSet(set({ reps: 20 }), 'lb'), '20 reps');
  assert.equal(formatReportSet(set({ durationSeconds: 70 }), 'lb'), '70s');
  assert.equal(formatReportSet(set(), 'lb'), '—');
});

test('a personal record is starred', () => {
  assert.equal(formatReportSet(set({ weight: 100, reps: 5, isPr: true }), 'kg'), '100 kg × 5 ★');
});

test('durations read as minutes or hours', () => {
  assert.equal(formatReportDuration(2_700), '45 min');
  assert.equal(formatReportDuration(3_600), '1 hr');
  assert.equal(formatReportDuration(4_500), '1 hr 15 min');
  assert.equal(formatReportDuration(undefined), '');
});

test('markup in a name cannot break out of the document', () => {
  assert.equal(escapeHtml('<b>"A&B"</b>'), '&lt;b&gt;&quot;A&amp;B&quot;&lt;/b&gt;');
  const html = buildWorkoutHistoryHtml(
    [session('1', '2026-10-01T15:00:00Z', '<script>alert(1)</script>', [[set({ reps: 5 })]])],
    { weightUnit: 'lb', timeZone: 'UTC' },
  );
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('totals count every set, volume and record across sessions', () => {
  const totals = summarizeWorkoutHistory([
    session('1', '2026-09-01T10:00:00Z', 'A', [[set({ weight: 100, reps: 5, isPr: true }), set({ weight: 100, reps: 5 })]]),
    session('2', '2026-10-01T10:00:00Z', 'B', [[set({ reps: 20 })]]),
  ]);
  assert.equal(totals.sessions, 2);
  assert.equal(totals.sets, 3);
  assert.equal(totals.volumeKg, 1_000);
  assert.equal(totals.personalRecords, 1);
  assert.equal(totals.firstSessionAt, '2026-09-01T10:00:00Z');
  assert.equal(totals.lastSessionAt, '2026-10-01T10:00:00Z');
});

test('sessions are listed newest first and exercises in workout order', () => {
  const html = buildWorkoutHistoryHtml(
    [
      session('old', '2026-09-01T10:00:00Z', 'Older Day', [[set({ reps: 5 })]]),
      session('new', '2026-10-01T10:00:00Z', 'Newer Day', [[set({ reps: 5 })], [set({ reps: 6 })]]),
    ],
    { weightUnit: 'lb', timeZone: 'UTC' },
  );
  assert.ok(html.indexOf('Newer Day') < html.indexOf('Older Day'));
  assert.ok(html.indexOf('Lift 1') < html.indexOf('Lift 2'));
});

test('a late-evening session lands on the lifter\'s own calendar day', () => {
  const html = buildWorkoutHistoryHtml(
    [session('1', '2026-10-02T02:30:00Z', 'Evening', [[set({ reps: 5 })]])],
    { weightUnit: 'lb', timeZone: 'America/Los_Angeles' },
  );
  assert.ok(html.includes('Oct 1, 2026'));
});

test('exercises with no sets are left out and an empty session says so', () => {
  const html = buildWorkoutHistoryHtml(
    [
      session('1', '2026-10-01T10:00:00Z', 'Skipped', [[]]),
      session('2', '2026-10-02T10:00:00Z', 'Done', [[], [set({ reps: 5 })]]),
    ],
    { weightUnit: 'lb', timeZone: 'UTC' },
  );
  assert.ok(html.includes('No sets were logged in this session.'));
  assert.ok(!html.includes('Lift 1'));
  assert.ok(html.includes('Lift 2'));
});

test('an empty history still produces a valid document', () => {
  const html = buildWorkoutHistoryHtml([], { weightUnit: 'kg' });
  assert.ok(html.includes('No completed workouts to show.'));
  assert.ok(html.includes('No sessions yet'));
});
