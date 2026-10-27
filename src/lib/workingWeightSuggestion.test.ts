import assert from 'node:assert/strict';
import test from 'node:test';

import { lightDayWorkingSuggestion } from './workingWeightSuggestion';

const LB = 0.45359237;
const set = (lb: number, reps: number, loggedAt: string) => ({ weightKg: lb * LB, reps, loggedAt });
const zone = 'America/Los_Angeles';

// Back Squat as logged: Oct 17 worked up 225 → 295, Oct 21 was three empty-bar sets.
const squatHistory = [
  set(45, 20, '2026-10-21T11:04:50Z'),
  set(45, 20, '2026-10-21T11:03:03Z'),
  set(45, 20, '2026-10-21T11:00:34Z'),
  set(295, 6, '2026-10-17T13:45:00Z'),
  set(275, 6, '2026-10-17T13:40:00Z'),
  set(225, 6, '2026-10-17T13:35:00Z'),
];

test('an empty-bar day does not replace the working weight', () => {
  const suggestion = lightDayWorkingSuggestion(squatHistory, zone);
  assert.ok(suggestion);
  assert.equal(Math.round(suggestion.weightKg / LB), 225);
  assert.equal(suggestion.reps, 6);
  assert.equal(Math.round(suggestion.lowWeightKg / LB), 225);
  assert.equal(Math.round(suggestion.highWeightKg / LB), 295);
  assert.equal(suggestion.date, '2026-10-17');
});

test('warm-ups logged in the reference session are not where the suggestion starts', () => {
  const history = [
    set(45, 20, '2026-10-21T11:00:00Z'),
    set(135, 12, '2026-10-01T10:41:00Z'),
    set(135, 12, '2026-10-01T10:38:00Z'),
    set(45, 20, '2026-10-01T10:35:00Z'),
  ];
  const suggestion = lightDayWorkingSuggestion(history, zone);
  assert.equal(Math.round((suggestion?.weightKg ?? 0) / LB), 135);
  assert.equal(suggestion?.date, '2026-10-01');
});

test('a normal session, or a modest back-off, keeps the newest-set rule', () => {
  assert.equal(lightDayWorkingSuggestion(squatHistory.slice(3), zone), null);
  const backOff = [set(185, 8, '2026-10-21T11:00:00Z'), ...squatHistory.slice(3)];
  assert.equal(lightDayWorkingSuggestion(backOff, zone), null);
});

test('a single session has nothing to compare against', () => {
  assert.equal(lightDayWorkingSuggestion(squatHistory.slice(0, 3), zone), null);
});
