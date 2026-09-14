import assert from 'node:assert/strict';
import test from 'node:test';

import {
  detectExecutionHint,
  executionHintForDay,
  heuristicParseProgramText,
  mergeExecutionHint,
} from './pdfProgramParse.js';

/**
 * A document that says "Tabata" has to come out of the import as a Tabata day, otherwise it
 * materializes as straight sets and the lifter never reaches the interval timer.
 */

test('a named protocol is read off a line', () => {
  assert.equal(detectExecutionHint('Day 4 — Tabata Finisher')?.executionMode, 'tabata');
  assert.equal(detectExecutionHint('Day 2: HIIT conditioning')?.executionMode, 'hiit');
  assert.equal(detectExecutionHint('Day 3 — Circuit')?.executionMode, 'circuit');
  assert.equal(detectExecutionHint('High-intensity interval work')?.executionMode, 'hiit');
});

test('an ordinary training day declares no mode', () => {
  assert.equal(detectExecutionHint('Day 1 — Push'), null);
  assert.equal(detectExecutionHint('Bench Press 4x8'), null);
});

test('interval timing is read in the wordings a plan actually uses', () => {
  for (const line of [
    'Tabata: 20s on / 10s off',
    'Tabata — 20 sec on, 10 sec off',
    'Tabata 20 seconds work 10 seconds rest',
    'Tabata: 20s work / 10s rest',
  ]) {
    const hint = detectExecutionHint(line);
    assert.equal(hint?.intervalWorkSeconds, 20, line);
    assert.equal(hint?.intervalRestSeconds, 10, line);
  }
});

test('work/rest wording with no named protocol is still interval training', () => {
  const hint = detectExecutionHint('30 seconds on, 15 seconds off');
  assert.equal(hint?.executionMode, 'hiit');
  assert.equal(hint?.intervalWorkSeconds, 30);
});

test('rounds are read once a mode is established', () => {
  assert.equal(detectExecutionHint('Tabata 20s on / 10s off x 8 rounds')?.intervalRounds, 8);
  assert.equal(detectExecutionHint('Circuit — 4 rounds')?.intervalRounds, 4);
});

test('rounds alone never imply a mode', () => {
  // Plenty of straight-set accessory work is written as "3 rounds".
  assert.equal(detectExecutionHint('3 rounds'), null);
});

test('a bare ratio is not mistaken for an interval', () => {
  // A rep scheme, a date and a percentage all look like "20/10" without the on/off wording.
  assert.equal(detectExecutionHint('Back Squat 5/3/1'), null);
  assert.equal(detectExecutionHint('Week of 20/10'), null);
});

test('interval timings are dropped from a mode that does not run on a clock', () => {
  const hint = { executionMode: 'circuit', intervalWorkSeconds: 30, intervalRestSeconds: 15, intervalRounds: 4 };
  assert.deepEqual(executionHintForDay(hint), { executionMode: 'circuit' });
});

test('a traditional day carries nothing', () => {
  assert.deepEqual(executionHintForDay({ executionMode: 'traditional', intervalRounds: 8 }), {});
  assert.deepEqual(executionHintForDay({ intervalRounds: 8 }), {});
});

test('the day header wins over a later line', () => {
  const merged = mergeExecutionHint({ executionMode: 'tabata' }, { executionMode: 'circuit', intervalRounds: 4 });
  assert.equal(merged.executionMode, 'tabata');
  assert.equal(merged.intervalRounds, 4);
});

test('a Tabata day in a document survives the heuristic parse', () => {
  const text = [
    'Day 1 — Push',
    'Bench Press 4x8',
    'Overhead Press 3x10',
    'Day 2 — Tabata Conditioning',
    'Tabata: 20s on / 10s off x 8 rounds',
    'Kettlebell Swing 4x20',
    'Burpees 4x15',
    'Day 3 — Rest',
  ].join('\n');

  const parsed = heuristicParseProgramText(text, 'workout');
  const days = parsed.workout?.days ?? [];
  assert.equal(days.length, 3);

  assert.equal(days[0]?.executionMode, undefined);

  assert.equal(days[1]?.executionMode, 'tabata');
  assert.equal(days[1]?.intervalWorkSeconds, 20);
  assert.equal(days[1]?.intervalRestSeconds, 10);
  assert.equal(days[1]?.intervalRounds, 8);
  // The protocol line must not eat the exercises that follow it.
  assert.equal(days[1]?.exercises?.length, 2);
  assert.equal(days[1]?.isRest, false);

  assert.equal(days[2]?.isRest, true);
});

test('a protocol line containing the word rest does not turn the day into a rest day', () => {
  const text = ['Day 1 — Conditioning', '30 seconds work, 15 seconds rest', 'Rower 4x1'].join('\n');
  const day = heuristicParseProgramText(text, 'workout').workout?.days[0];
  assert.equal(day?.isRest, false);
  assert.equal(day?.executionMode, 'hiit');
  assert.equal(day?.intervalRestSeconds, 15);
});

test('a protocol stated before any day header applies to the whole document', () => {
  const text = [
    'This block is run Tabata style throughout.',
    'Day 1 — Lower',
    'Goblet Squat 4x20',
    'Day 2 — Upper',
    'Push Up 4x15',
  ].join('\n');

  const days = heuristicParseProgramText(text, 'workout').workout?.days ?? [];
  assert.equal(days[0]?.executionMode, 'tabata');
  assert.equal(days[1]?.executionMode, 'tabata');
});

test('a rest day never carries a mode', () => {
  const text = ['Day 1 — Tabata', 'Burpees 4x15', 'Day 2 — Rest'].join('\n');
  const days = heuristicParseProgramText(text, 'workout').workout?.days ?? [];
  assert.equal(days[1]?.isRest, true);
  assert.equal(days[1]?.executionMode, undefined);
});
