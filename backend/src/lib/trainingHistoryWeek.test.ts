import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { trainingWeekFromSessionDates } from './trainingHistoryWeek.js';

// Mondays, so the week boundaries in these cases are unambiguous.
const WEEK_1 = '2026-08-31';
const WEEK_2 = '2026-09-07';
const WEEK_3 = '2026-09-14';

describe('trainingWeekFromSessionDates', () => {
  it('puts a first-time athlete in week 1', () => {
    assert.equal(trainingWeekFromSessionDates([], WEEK_1), 1);
  });

  it('still says week 1 once sessions are logged this week', () => {
    assert.equal(trainingWeekFromSessionDates([WEEK_1, '2026-09-02'], '2026-09-04'), 1);
  });

  // The report: a week of training behind them, and the app said Week 1.
  it('says week 2 the week after the first week of training', () => {
    assert.equal(trainingWeekFromSessionDates(['2026-09-01', '2026-09-03'], WEEK_2), 2);
  });

  it('counts a week once however many sessions it holds', () => {
    const sixDays = ['01', '02', '03', '04', '05', '06'].map((day) => `2026-09-${day}`);
    assert.equal(trainingWeekFromSessionDates(sixDays, WEEK_2), 2);
  });

  it('does not credit a week nobody trained', () => {
    // Trained the first week, took the second off, back in the third.
    assert.equal(trainingWeekFromSessionDates(['2026-09-01'], WEEK_3), 2);
  });

  it('counts the week a Sunday session belongs to, not the next one', () => {
    // 2026-09-06 is the Sunday that closes week 1.
    assert.equal(trainingWeekFromSessionDates(['2026-09-06'], WEEK_2), 2);
    assert.equal(trainingWeekFromSessionDates(['2026-09-06'], '2026-09-06'), 1);
  });

  it('reads a full timestamp as the day it falls on', () => {
    assert.equal(trainingWeekFromSessionDates(['2026-09-01T18:30:00.000Z'], WEEK_2), 2);
  });

  it('ignores rows with no usable date', () => {
    assert.equal(trainingWeekFromSessionDates(['', 'not-a-date', '2026-09-01'], WEEK_2), 2);
  });

  it('survives the program record being replaced', () => {
    // A plan imported today creates a new program starting today. The calendar arithmetic this
    // replaced would read that as Week 1; the history behind it still says otherwise.
    const history = ['2026-08-25', '2026-09-01', '2026-09-08'];
    assert.equal(trainingWeekFromSessionDates(history, WEEK_3), 4);
  });
});
