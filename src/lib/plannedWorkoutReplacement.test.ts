import assert from 'node:assert/strict';
import test from 'node:test';

import { pickReplacementPlannedRow, type ReplaceablePlannedRow } from './plannedWorkoutReplacement';

const PROGRAM = '2d269f46';

function cycleRow(id: string, date: string, cycleDay: number, status = 'planned'): ReplaceablePlannedRow {
  return {
    id,
    status,
    scheduled_date: date,
    created_at: '2026-10-27T10:31:29Z',
    metadata: { planPack: 'custom_cycle', programId: PROGRAM, cycleDay },
  };
}

test('a missed day pushed Legs back a date: the edit follows Legs, not whatever took its date', () => {
  const openedLegs = cycleRow('old-legs', '2026-10-27', 3, 'cancelled');
  const now = [
    cycleRow('chest', '2026-10-27', 2),
    cycleRow('legs', '2026-10-28', 3),
    cycleRow('shoulders', '2026-10-29', 4),
    cycleRow('next-lap-legs', '2026-11-03', 3),
  ];
  assert.equal(pickReplacementPlannedRow(openedLegs, now)?.id, 'legs');
});

test('a day from a plan that was replaced falls back to what is planned on its date', () => {
  const opened = { ...cycleRow('old', '2026-10-27', 3, 'cancelled'), metadata: { planPack: 'custom_cycle', programId: 'old-plan', cycleDay: 3 } };
  const now = [cycleRow('today', '2026-10-27', 1), cycleRow('legs', '2026-10-29', 3)];
  assert.equal(pickReplacementPlannedRow(opened, now)?.id, 'today');
});

test('an edit never lands on a different workout that only took the date', () => {
  const opened = { ...cycleRow('old', '2026-10-27', 3, 'cancelled'), metadata: { planPack: 'custom_cycle', programId: 'old-plan', cycleDay: 3 } };
  const now = [cycleRow('today', '2026-10-27', 1)];
  assert.equal(pickReplacementPlannedRow(opened, now, { sameWorkoutOnly: true }), null);

  const calendar: ReplaceablePlannedRow = { id: 'old', status: 'cancelled', scheduled_date: '2026-10-27', name: 'Push' };
  const rows: ReplaceablePlannedRow[] = [
    { id: 'pull', status: 'planned', scheduled_date: '2026-10-27', name: 'Pull' },
    { id: 'push', status: 'planned', scheduled_date: '2026-10-27', name: 'Push' },
  ];
  assert.equal(pickReplacementPlannedRow(calendar, rows, { sameWorkoutOnly: true })?.id, 'push');
  assert.equal(pickReplacementPlannedRow(calendar, rows.slice(0, 1), { sameWorkoutOnly: true }), null);
});

test('finished and cancelled rows never stand in for a workout', () => {
  const opened = cycleRow('old-legs', '2026-10-27', 3, 'cancelled');
  const now = [cycleRow('done', '2026-10-27', 3, 'completed'), cycleRow('gone', '2026-10-28', 3, 'cancelled')];
  assert.equal(pickReplacementPlannedRow(opened, now), null);
});

test('a calendar-plan row is replaced by the newest row planned on the same date', () => {
  const opened: ReplaceablePlannedRow = { id: 'old', status: 'cancelled', scheduled_date: '2026-10-27' };
  const now: ReplaceablePlannedRow[] = [
    { id: 'older', status: 'planned', scheduled_date: '2026-10-27', created_at: '2026-10-27T09:00:00Z' },
    { id: 'newer', status: 'planned', scheduled_date: '2026-10-27', created_at: '2026-10-27T10:00:00Z' },
    { id: 'other-day', status: 'planned', scheduled_date: '2026-10-28', created_at: '2026-10-27T11:00:00Z' },
  ];
  assert.equal(pickReplacementPlannedRow(opened, now)?.id, 'newer');
});
