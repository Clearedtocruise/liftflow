/**
 * Reading back more training than fits in one page.
 *
 * History showed the twenty most recent sessions and stopped; the query even returned a hasMore
 * flag that the screen threw away. Paging it is not just "ask for page two", because lifts and
 * cardio are separate records merged by date: the second page of lifts can be older than cardio
 * nobody has fetched yet, so appending pages source by source puts sessions under entries they
 * happened after.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  appendActivityHistory,
  groupHistoryByMonth,
  mergeActivityHistoryPage,
} from './activityHistoryPage';

import type { WorkoutHistoryItem } from '@/types/workout';

const item = (id: string, date: string, kind: 'strength' | 'cardio' = 'strength'): WorkoutHistoryItem => ({
  id,
  name: kind === 'cardio' ? 'Run' : 'Push Day',
  date,
  durationMinutes: 45,
  exerciseCount: kind === 'cardio' ? 0 : 5,
  totalSets: kind === 'cardio' ? 0 : 15,
  totalVolume: kind === 'cardio' ? 0 : 5000,
  status: 'completed',
  sessionKind: kind,
});

test('both records exhausted means the whole history is on this page', () => {
  const page = mergeActivityHistoryPage({
    strength: [item('s1', '2026-09-20T17:00:00Z')],
    cardio: [item('c1', '2026-09-19T08:00:00Z', 'cardio')],
    strengthHasMore: false,
    cardioHasMore: false,
  });

  assert.equal(page.hasMore, false);
  assert.equal(page.nextBefore, null);
  assert.deepEqual(page.items.map((entry) => entry.id), ['s1', 'c1']);
});

test('a page stops where the shallower record runs out, not where the deeper one does', () => {
  // Cardio has been read back to the 10th and has more; lifts only to the 18th. Showing anything
  // older than the 18th would mean showing lifts with cardio missing from between them.
  const page = mergeActivityHistoryPage({
    strength: [item('s1', '2026-09-20T17:00:00Z'), item('s2', '2026-09-18T17:00:00Z')],
    cardio: [item('c1', '2026-09-19T08:00:00Z', 'cardio'), item('c2', '2026-09-10T08:00:00Z', 'cardio')],
    strengthHasMore: true,
    cardioHasMore: true,
  });

  assert.deepEqual(page.items.map((entry) => entry.id), ['s1', 'c1', 's2']);
  assert.equal(page.nextBefore, '2026-09-18T17:00:00.000Z');
  assert.equal(page.hasMore, true);
});

test('a record with nothing left still waits at the other record’s floor', () => {
  const page = mergeActivityHistoryPage({
    strength: [item('s1', '2026-09-20T17:00:00Z'), item('s2', '2026-09-18T17:00:00Z')],
    cardio: [item('c1', '2026-08-01T08:00:00Z', 'cardio')],
    strengthHasMore: true,
    cardioHasMore: false,
  });

  // Cardio has nothing left, but an August run shown now would have September lifts land above it
  // on the next page — a list that rearranges itself under a reader mid-scroll. It waits instead,
  // and comes back with the page that reaches it, so the history only ever grows downward.
  assert.deepEqual(page.items.map((entry) => entry.id), ['s1', 's2']);
  assert.equal(page.nextBefore, '2026-09-18T17:00:00.000Z');
  assert.equal(page.hasMore, true);
});

test('the run that waited arrives with the page that reaches it', () => {
  const page = mergeActivityHistoryPage({
    strength: [item('s3', '2026-09-15T17:00:00Z')],
    cardio: [item('c1', '2026-08-01T08:00:00Z', 'cardio')],
    strengthHasMore: false,
    cardioHasMore: false,
  });

  assert.deepEqual(page.items.map((entry) => entry.id), ['s3', 'c1']);
  assert.equal(page.hasMore, false);
});

test('the cursor is inclusive and the duplicate it causes is kept once', () => {
  const first = [item('s1', '2026-09-20T17:00:00Z'), item('s2', '2026-09-18T17:00:00Z')];
  // The next page starts at the cutoff itself, so the session sitting on it comes back again.
  const second = [item('s2', '2026-09-18T17:00:00Z'), item('s3', '2026-09-15T17:00:00Z')];

  const combined = appendActivityHistory(first, second);
  assert.deepEqual(combined.map((entry) => entry.id), ['s1', 's2', 's3']);
});

test('an older page lands below what is already on screen', () => {
  const combined = appendActivityHistory(
    [item('s1', '2026-09-20T17:00:00Z')],
    [item('c1', '2026-09-19T08:00:00Z', 'cardio'), item('s2', '2026-09-12T17:00:00Z')],
  );
  assert.deepEqual(combined.map((entry) => entry.id), ['s1', 'c1', 's2']);
});

test('a long history reads as the months it was trained in', () => {
  const months = groupHistoryByMonth(
    [
      item('s1', '2026-09-20T17:00:00Z'),
      item('s2', '2026-09-02T17:00:00Z'),
      item('s3', '2026-08-28T17:00:00Z'),
      item('s4', '2025-12-30T17:00:00Z'),
    ],
    new Date('2026-09-23T12:00:00Z'),
  );

  assert.deepEqual(months.map((month) => month.key), ['2026-09', '2026-08', '2025-12']);
  assert.deepEqual(months[0].items.map((entry) => entry.id), ['s1', 's2']);
  assert.match(months[0].label, /September/);
  assert.match(months[2].label, /2025/, 'a past year has to say which year it was');
  assert.doesNotMatch(months[0].label, /2026/, 'this year needs no year on it');
});

test('an unreadable date is left out rather than heading a month of its own', () => {
  const months = groupHistoryByMonth([item('bad', 'not-a-date'), item('s1', '2026-09-20T17:00:00Z')]);
  assert.equal(months.length, 1);
  assert.deepEqual(months[0].items.map((entry) => entry.id), ['s1']);
});
