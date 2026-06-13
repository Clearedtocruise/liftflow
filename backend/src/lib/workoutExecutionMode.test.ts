import assert from 'node:assert/strict';
import { formatExercisePrescriptionSummary, prescribeExerciseExecution } from './workoutExecutionMode.js';

const benchPress = { name: 'Bench Press', sets: 3, repRange: '10' };

const traditional = prescribeExerciseExecution({ ...benchPress, mode: 'traditional' });
assert.equal(traditional.scheme, 'set_rep');
assert.equal(formatExercisePrescriptionSummary(traditional), '3 x 10');

const tabata = prescribeExerciseExecution({ ...benchPress, mode: 'tabata' });
assert.equal(tabata.scheme, 'interval');
assert.equal(formatExercisePrescriptionSummary(tabata), '20 sec work · 10 sec rest · 10 rounds');

const hiit = prescribeExerciseExecution({ ...benchPress, mode: 'hiit' });
assert.equal(hiit.scheme, 'interval');
assert.equal(formatExercisePrescriptionSummary(hiit), '45 sec work · 15 sec rest · 8 rounds');

const strength = prescribeExerciseExecution({ name: 'Bench Press', mode: 'strength' });
assert.equal(strength.scheme, 'set_rep');
assert.equal(strength.sets, 5);
assert.equal(strength.repRange, '3-5');

const hypertrophy = prescribeExerciseExecution({ name: 'Bench Press', mode: 'hypertrophy' });
assert.equal(hypertrophy.sets, 4);
assert.equal(hypertrophy.repRange, '8-12');

const circuit = prescribeExerciseExecution({ name: 'Bench Press', mode: 'circuit' });
assert.equal(circuit.scheme, 'circuit');
assert.equal(circuit.rounds, 3);

const superset = prescribeExerciseExecution({ name: 'Bench Press', mode: 'superset' });
assert.equal(superset.scheme, 'superset');
assert.equal(superset.restBetweenExercisesSeconds, 0);

console.log('workoutExecutionMode.test.ts — all assertions passed');
