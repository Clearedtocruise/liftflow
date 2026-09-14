import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cycleToDraft,
  draftToCycleInput,
  setDayExecutionMode,
  setDayIntervalField,
  toggleRestDay,
  type DraftDay,
} from './programCycleEditor';
import { prescribeExerciseExecution } from './workoutExecutionMode';
import { tabataConfigFromPlan } from './trainingPreferences';
import { exercisesFromPlannedWorkout } from './workoutPlan';
import type { PlannedWorkout } from '@/types/training';

const clampRounds = (rounds: number) => Math.min(12, Math.max(1, Math.round(rounds)));

/**
 * The editor sits between the parse and the live program, so anything it cannot represent is
 * silently erased on the way through. These pin the fields that used to be lost.
 */

test('an edit no longer resets rest, mode or pairing', () => {
  const days = cycleToDraft([
    {
      label: 'Heavy Singles',
      exercises: [
        {
          name: 'Back Squat',
          sets: 5,
          repRange: '1-3',
          restSeconds: 180,
          executionMode: 'strength',
          supersetGroupId: 'a',
        },
      ],
    },
  ]);

  const exercise = draftToCycleInput('My Program', days).days[0]?.exercises?.[0];
  assert.equal(exercise?.restSeconds, 180, 'three minutes between heavy singles must survive an edit');
  assert.equal(exercise?.executionMode, 'strength');
  assert.equal(exercise?.supersetGroupId, 'a');
});

test('a day keeps its execution mode and interval timing through the editor', () => {
  const days = cycleToDraft([
    {
      label: 'Conditioning',
      executionMode: 'tabata',
      intervalWorkSeconds: 30,
      intervalRestSeconds: 15,
      intervalRounds: 8,
      exercises: [{ name: 'Burpees', sets: 4, repRange: '15' }],
    },
  ]);

  assert.equal(days[0]?.executionMode, 'tabata');
  const day = draftToCycleInput(undefined, days).days[0];
  assert.equal(day?.executionMode, 'tabata');
  assert.equal(day?.intervalWorkSeconds, 30);
  assert.equal(day?.intervalRestSeconds, 15);
  assert.equal(day?.intervalRounds, 8);
});

test('choosing traditional clears the interval prescription rather than leaving it behind', () => {
  let days: DraftDay[] = [
    {
      label: 'Conditioning',
      isRest: false,
      executionMode: 'tabata',
      intervalWorkSeconds: 30,
      intervalRestSeconds: 15,
      intervalRounds: 8,
      exercises: [{ name: 'Burpees', sets: 4, reps: '15' }],
    },
  ];

  days = setDayExecutionMode(days, 0, 'traditional');
  assert.equal(days[0]?.executionMode, undefined);
  assert.equal(days[0]?.intervalWorkSeconds, undefined);

  const day = draftToCycleInput(undefined, days).days[0];
  assert.equal(day?.executionMode, undefined);
  assert.equal(day?.intervalRounds, undefined);
});

test('a mode that does not run on a clock drops the interval timings', () => {
  let days: DraftDay[] = [
    { label: 'Conditioning', isRest: false, executionMode: 'tabata', intervalRounds: 8, exercises: [] },
  ];
  days = setDayExecutionMode(days, 0, 'circuit');
  assert.equal(days[0]?.executionMode, 'circuit');
  assert.equal(days[0]?.intervalRounds, undefined);
});

test('an interval field cleared to zero stops being prescribed', () => {
  let days: DraftDay[] = [
    { label: 'Conditioning', isRest: false, executionMode: 'tabata', intervalRounds: 8, exercises: [] },
  ];
  days = setDayIntervalField(days, 0, 'intervalRounds', 0);
  assert.equal(days[0]?.intervalRounds, undefined);
});

test('a day turned into a rest day commits no mode', () => {
  let days: DraftDay[] = [
    {
      label: 'Conditioning',
      isRest: false,
      executionMode: 'tabata',
      intervalRounds: 8,
      exercises: [{ name: 'Burpees', sets: 4, reps: '15' }],
    },
  ];
  days = toggleRestDay(days, 0);
  const day = draftToCycleInput(undefined, days).days[0];
  assert.equal(day?.isRest, true);
  assert.equal(day?.executionMode, undefined);
  assert.equal(day?.intervalRounds, undefined);
});

test("a plan's own intervals are prescribed ahead of the mode defaults", () => {
  const prescription = prescribeExerciseExecution({
    name: 'Burpees',
    mode: 'tabata',
    sets: 4,
    intervalWorkSeconds: 30,
    intervalRestSeconds: 15,
    intervalRounds: 8,
  });

  assert.equal(prescription.scheme, 'interval');
  if (prescription.scheme !== 'interval') return;
  assert.equal(prescription.workSeconds, 30);
  assert.equal(prescription.restSeconds, 15);
  assert.equal(prescription.rounds, 8);
});

test('a plan with no intervals of its own still gets the mode defaults', () => {
  const prescription = prescribeExerciseExecution({ name: 'Burpees', mode: 'tabata', sets: 3 });
  assert.equal(prescription.scheme, 'interval');
  if (prescription.scheme !== 'interval') return;
  assert.equal(prescription.workSeconds, 20);
  assert.equal(prescription.restSeconds, 10);
  assert.equal(prescription.rounds, 3);
});

test("a materialized Tabata day reaches the session as Tabata, on the plan's own clock", () => {
  const planned = {
    metadata: {
      executionMode: 'tabata',
      intervalWorkSeconds: 30,
      intervalRestSeconds: 15,
      intervalRounds: 8,
      exercises: [
        { name: 'Burpees', sets: 4, repRange: '15' },
        { name: 'Kettlebell Swing', sets: 4, repRange: '20' },
      ],
    },
  } as unknown as PlannedWorkout;

  const plan = exercisesFromPlannedWorkout(planned);
  assert.equal(plan.length, 2);
  for (const exercise of plan) {
    assert.equal(exercise.executionMode, 'tabata');
    assert.equal(exercise.intervalWorkSeconds, 30);
    assert.equal(exercise.intervalRestSeconds, 15);
    assert.equal(exercise.intervalRounds, 8);
  }

  // The session-wide Tabata clock opens on what the plan asked for, not on this app's defaults.
  assert.deepEqual(tabataConfigFromPlan(plan, clampRounds), {
    workSeconds: 30,
    restSeconds: 15,
    rounds: 8,
  });
});

test('a plan that prescribes nothing opens the Tabata clock on the defaults', () => {
  assert.deepEqual(tabataConfigFromPlan([{}, {}], clampRounds), {
    workSeconds: 20,
    restSeconds: 10,
    rounds: 3,
  });
});

test('an out-of-range prescription is clamped rather than run as written', () => {
  const config = tabataConfigFromPlan(
    [{ intervalWorkSeconds: 600, intervalRestSeconds: 1, intervalRounds: 40 }],
    clampRounds,
  );
  assert.equal(config.workSeconds, 45);
  assert.equal(config.restSeconds, 10);
  assert.equal(config.rounds, 12);
});

test('a traditional day is unaffected by any of this', () => {
  const planned = {
    metadata: { exercises: [{ name: 'Bench Press', sets: 4, repRange: '6-8', restSeconds: 180 }] },
  } as unknown as PlannedWorkout;

  const plan = exercisesFromPlannedWorkout(planned);
  assert.equal(plan[0]?.executionMode, 'traditional');
  assert.equal(plan[0]?.restSeconds, 180);
  assert.equal(plan[0]?.intervalWorkSeconds, undefined);
});
