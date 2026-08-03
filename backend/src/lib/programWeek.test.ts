/**
 * Program week counting.
 *
 * These helpers decide which week of a program an athlete is on, which names every workout
 * ("Push — Week 2") and drives phase selection and progression. They are calendar-date maths and
 * must not depend on the server's timezone or on daylight saving.
 */

// Set before any Date work so the assertions below run against a DST timezone rather than the
// machine's. US spring-forward is what broke the original implementation.
process.env.TZ = 'America/Los_Angeles';

import assert from 'node:assert/strict';
import test from 'node:test';

import { addDays, currentProgramWeek, weekStartFromDate } from './programTypes.js';

test('a program week turns over on day 7, not before', () => {
  const start = '2026-07-27'; // Monday
  assert.equal(currentProgramWeek(start, '2026-07-27'), 1);
  assert.equal(currentProgramWeek(start, '2026-08-01'), 1); // Saturday, day 6
  assert.equal(currentProgramWeek(start, '2026-08-02'), 1); // Sunday, day 7 of week 1
  assert.equal(currentProgramWeek(start, '2026-08-03'), 2); // Monday
  assert.equal(currentProgramWeek(start, '2026-08-09'), 2);
  assert.equal(currentProgramWeek(start, '2026-08-10'), 3);
});

test('daylight saving does not cost the athlete a week', () => {
  // A week across US spring-forward is 167 hours. Flooring that at 24h per day lost a day, so the
  // program reported the previous week from March onward and never caught up.
  assert.equal(currentProgramWeek('2026-03-02', '2026-03-09'), 2);
  assert.equal(currentProgramWeek('2026-03-02', '2026-03-16'), 3);
  assert.equal(currentProgramWeek('2026-03-02', '2026-03-23'), 4);

  // Fall back gives a 169-hour week, which must not advance early either.
  assert.equal(currentProgramWeek('2026-10-26', '2026-11-01'), 1);
  assert.equal(currentProgramWeek('2026-10-26', '2026-11-02'), 2);
});

test('a program never reports week zero or a negative week', () => {
  assert.equal(currentProgramWeek('2026-08-03', '2026-08-03'), 1);
  // A start date in the future (clock skew, or a plan built ahead) still reads as week 1.
  assert.equal(currentProgramWeek('2026-08-10', '2026-08-03'), 1);
});

test('the week always starts on Monday, from any day of that week', () => {
  const monday = '2026-07-27';
  for (const day of ['2026-07-27', '2026-07-28', '2026-07-29', '2026-07-30', '2026-07-31', '2026-08-01', '2026-08-02']) {
    assert.equal(weekStartFromDate(day), monday, `${day} belongs to the week starting ${monday}`);
  }
  // Sunday is the last day of the training week, not the first of the next.
  assert.equal(weekStartFromDate('2026-08-03'), '2026-08-03');
});

test('adding days crosses a DST boundary without losing or gaining one', () => {
  assert.equal(addDays('2026-03-02', 7), '2026-03-09');
  assert.equal(addDays('2026-03-06', 1), '2026-03-07');
  assert.equal(addDays('2026-03-07', 1), '2026-03-08'); // spring forward
  assert.equal(addDays('2026-03-08', 1), '2026-03-09');
  assert.equal(addDays('2026-10-31', 1), '2026-11-01'); // fall back
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-08-03', 0), '2026-08-03');
});

test('scheduled dates land on the right day for every week of a program', () => {
  // How the planner builds a workout date: addDays(startDate, (week - 1) * 7 + dayIndex).
  const start = '2026-03-02'; // Monday, one week before spring forward
  for (let week = 1; week <= 12; week += 1) {
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const date = addDays(start, (week - 1) * 7 + dayIndex);
      assert.equal(
        weekStartFromDate(date),
        addDays(start, (week - 1) * 7),
        `week ${week} day ${dayIndex} (${date}) must sit in that program week`,
      );
      assert.equal(
        currentProgramWeek(start, date),
        week,
        `${date} should report week ${week}`,
      );
    }
  }
});
