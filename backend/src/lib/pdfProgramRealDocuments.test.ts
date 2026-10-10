import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { heuristicParseProgramText, splitDocumentIntoDaySections } from './pdfProgramParse.js';

/**
 * The shape of a real 30-day plan that imported wrongly: template-letter day headings, each lift
 * written over two lines, a calendar at the top and a meal plan at the bottom that both repeat
 * the same days, prose that opens on a weekday, and page numbers stranded mid-exercise.
 */
const TEMPLATE_LETTER_PLAN = `30-DAY WORKOUT + NUTRITION PLAN
Six training days per week. Fridays off.
Your 30-day calendar
A: Chest/triceps
Week 1: Oct 10
Week 2: Oct 17
B: Back/biceps
Week 1: Oct 11
Week 2: Oct 18
Workout basics
Each training day contains 7 exercises, excluding warm-ups.
Rest 2-3 minutes for squats, presses and rows; 60-90 seconds for smaller exercises.
A | CHEST + TRICEPS
Your chosen routine for today, Saturday, October 10, in the order you listed.
Warm-up | 5 minutes
Walk or march for 3-5 minutes, then perform arm circles.
1. Decline push-ups
Sets x reps: 2 x 6-12
Technique: Feet on stable bench; keep hips level.
2. Bench dips
Sets x reps: 2 x 8-12
Technique: Bench secured; knees bent.
Progression
Week 4: perform 1 set per exercise.
B | BACK + BICEPS
B | Back and biceps
One-arm dumbbell row, supported on bench
Sets x reps: 3 x 8-12 each side
Dumbbell shrug
3
Sets x reps: 2 x 10-15
Rest day
Friday uses the same calorie target initially, with the shake as a snack. Keep
protein consistent and use the weight-trend adjustment rules instead.
YOUR DAILY MEALS
SATURDAY | A: CHEST + TRICEPS
Breakfast
Portions: 2 eggs + 1/2 cup dry oats.
SUNDAY | B: BACK + BICEPS
Breakfast
Portions: 1 cup yogurt + 1 cup berries.
FRIDAY | REST DAY
Breakfast
Portions: 2 eggs + 1 cup berries.
`;

describe('reading a plan built on template letters', () => {
  it('reads the training days rather than the prose that opens on a weekday', () => {
    const preview = heuristicParseProgramText(TEMPLATE_LETTER_PLAN, 'workout');

    const labels = preview.workout!.days.map((day) => day.label);
    assert.ok(
      labels.every((label) => !/October 10|recovery|calorie/i.test(label)),
      `a sentence was read as a day: ${labels.join(' | ')}`,
    );
  });

  it('finds the lifts under letter headings, which carried no day number to match on', () => {
    const preview = heuristicParseProgramText(TEMPLATE_LETTER_PLAN, 'workout');

    assert.deepEqual(
      preview.workout!.days.map((day) => day.label),
      ['A | CHEST + TRICEPS', 'B | Back and biceps', 'Day 5 — Rest'],
    );
  });

  it('keeps the lift name when the prescription is on the line below it', () => {
    const preview = heuristicParseProgramText(TEMPLATE_LETTER_PLAN, 'workout');

    const names = preview.workout!.days[0].exercises.map((exercise) => exercise.name);
    assert.deepEqual(names, ['Decline push-ups', 'Bench dips']);
    assert.equal(preview.workout!.days[0].exercises[0].sets, 2);
    assert.equal(preview.workout!.days[0].exercises[0].reps, '6-12');
  });

  it('leaves coaching prose out of the exercise list', () => {
    const preview = heuristicParseProgramText(TEMPLATE_LETTER_PLAN, 'workout');

    const names = preview.workout!.days.flatMap((day) =>
      day.exercises.map((exercise) => exercise.name),
    );
    assert.ok(
      names.every((name) => !/week 4|technique|warm-up/i.test(name)),
      `prose was imported as a lift: ${names.join(' | ')}`,
    );
  });

  it('does not lose the lift whose prescription fell after a page break', () => {
    const preview = heuristicParseProgramText(TEMPLATE_LETTER_PLAN, 'workout');

    const backDay = preview.workout!.days.find((day) => /back/i.test(day.label));
    assert.deepEqual(
      backDay!.exercises.map((exercise) => exercise.name),
      ['One-arm dumbbell row, supported on bench', 'Dumbbell shrug'],
    );
  });

  it('reads the sessions rather than the calendar or the meal plan that repeat their days', () => {
    const preview = heuristicParseProgramText(TEMPLATE_LETTER_PLAN, 'both');

    const training = preview.workout!.days.filter((day) => !day.isRest);
    assert.equal(training.length, 2);
    assert.ok(training.every((day) => day.exercises.length > 0));
  });

  it('still keeps a day the plan calls a rest day', () => {
    const preview = heuristicParseProgramText(TEMPLATE_LETTER_PLAN, 'workout');

    const rest = preview.workout!.days.filter((day) => day.isRest);
    assert.equal(rest.length, 1);
    assert.equal(rest[0].exercises.length, 0);
  });

  it('does not call a day with seven lifts in it a rest day', () => {
    const preview = heuristicParseProgramText(TEMPLATE_LETTER_PLAN, 'workout');

    const chestDay = preview.workout!.days[0];
    assert.equal(chestDay.isRest, false);
  });

  it('asks the AI about the same days the heuristic would fall back to', () => {
    const sections = splitDocumentIntoDaySections(TEMPLATE_LETTER_PLAN);
    const preview = heuristicParseProgramText(TEMPLATE_LETTER_PLAN, 'workout');

    assert.deepEqual(
      sections.days.map((section) => section.label),
      preview.workout!.days.map((day) => day.label),
    );
  });
});

describe('weekday headings', () => {
  it('still starts a day on a weekday written as a heading', () => {
    const preview = heuristicParseProgramText(
      ['Monday — Push', 'Bench Press 4x8', 'Tuesday — Pull', 'Barbell Row 4x8'].join('\n'),
      'workout',
    );

    assert.equal(preview.workout!.days.length, 2);
  });

  it('does not start a day on a sentence that happens to begin on a weekday', () => {
    const preview = heuristicParseProgramText(
      [
        'Day 1 — Push',
        'Bench Press 4x8',
        'Saturday is your deload, so keep every working set two reps shy of failure.',
        'Overhead Press 3x10',
      ].join('\n'),
      'workout',
    );

    assert.equal(preview.workout!.days.length, 1);
    assert.equal(preview.workout!.days[0].exercises.length, 2);
  });
});

describe('prescriptions written on their own line', () => {
  it('reads a prescription written above its lift rather than below it', () => {
    const preview = heuristicParseProgramText(
      ['Day 1 — Legs', 'Warm-up', '3 x 10 Goblet squat'].join('\n'),
      'workout',
    );

    assert.deepEqual(
      preview.workout!.days[0].exercises.map((exercise) => exercise.name),
      ['Goblet squat'],
    );
  });

  it('reads a bare prescription under the lift it belongs to', () => {
    const preview = heuristicParseProgramText(
      ['Day 1 — Legs', 'Barbell back squat', '3 x 6-10'].join('\n'),
      'workout',
    );

    assert.deepEqual(
      preview.workout!.days[0].exercises.map((exercise) => exercise.name),
      ['Barbell back squat'],
    );
  });

  it('joins a lift name the extractor broke across two lines', () => {
    const preview = heuristicParseProgramText(
      ['Day 1 — Chest', '5. Standing underhand dumbbell', 'fly', 'Sets x reps: 2 x 12-15'].join(
        '\n',
      ),
      'workout',
    );

    assert.deepEqual(
      preview.workout!.days[0].exercises.map((exercise) => exercise.name),
      ['Standing underhand dumbbell fly'],
    );
  });
});
