import assert from 'node:assert/strict';

import { parsePlannedRepRange } from './exerciseCoachPrescription.js';
import {
  computeSmartProgression,
  type ProgressionSessionHistory,
  type ProgressionSetRecord,
} from './smartProgressionEngine.js';

function session(sets: ProgressionSetRecord[], sessionDate = '2026-10-01'): ProgressionSessionHistory {
  return {
    sessionId: `s-${sessionDate}`,
    sessionDate,
    sets,
    totalVolume: sets.reduce((sum, s) => sum + s.weightKg * s.reps, 0),
  };
}

function run() {
  // Reported bug: 20-25 bodyweight reps came back as a 12-rep recommendation because
  // `fat_loss` defaults to a 12-rep target and the mid-session branch ignored the set just logged.
  const midSessionBodyweight = computeSmartProgression({
    exerciseName: 'Decline Push-Ups',
    priorSessions: [],
    currentSessionSets: [{ weightKg: 0, reps: 20, setNumber: 1 }],
    goalFocus: 'fat_loss',
  });
  assert.equal(midSessionBodyweight.recommended.reps, 20);
  assert.equal(midSessionBodyweight.recommended.weightKg, 0);
  assert.equal(midSessionBodyweight.voiceNextSetLine, 'Aim for 20 reps.');
  assert.ok(midSessionBodyweight.targetRepRange.max >= 20);

  const twentyFive = computeSmartProgression({
    exerciseName: 'Decline Push-Ups',
    priorSessions: [],
    currentSessionSets: [{ weightKg: 0, reps: 25, setNumber: 1 }],
    goalFocus: 'fat_loss',
  });
  assert.equal(twentyFive.recommended.reps, 25);

  // Same lift logged against a token 1 lb load, which is how it reads before the exercise is
  // reclassified as bodyweight. The floor keys off the load actually logged, not a rounded one.
  const tokenLoad = computeSmartProgression({
    exerciseName: 'Decline Push-Ups',
    priorSessions: [],
    currentSessionSets: [{ weightKg: 1 / 2.2046226218, reps: 20, setNumber: 1 }],
    goalFocus: 'fat_loss',
  });
  assert.equal(tokenLoad.recommended.reps, 20);

  // Between sessions a bodyweight lift has no load to add, so reps are the only progression.
  const crossSessionBodyweight = computeSmartProgression({
    exerciseName: 'Decline Push-Ups',
    priorSessions: [
      session([
        { weightKg: 0, reps: 20, setNumber: 1 },
        { weightKg: 0, reps: 20, setNumber: 2 },
        { weightKg: 0, reps: 18, setNumber: 3 },
      ]),
    ],
    currentSessionSets: [],
    goalFocus: 'fat_loss',
  });
  assert.equal(crossSessionBodyweight.recommended.reps, 21);
  assert.equal(crossSessionBodyweight.adjustmentType, 'rep_progression');

  // The program's prescription outranks the goal default, even with no history to learn from.
  const plannedRange = computeSmartProgression({
    exerciseName: 'Decline Push-Ups',
    priorSessions: [],
    currentSessionSets: [],
    goalFocus: 'fat_loss',
    plannedRepRange: { min: 20, max: 25 },
  });
  assert.equal(plannedRange.recommended.reps, 20);
  assert.deepEqual(plannedRange.targetRepRange, { min: 20, max: 25 });

  // Loaded lifts keep adding weight rather than reps — the floor finds no sets at the new load.
  const loadedOverload = computeSmartProgression({
    exerciseName: 'Barbell Bench Press',
    priorSessions: [
      session([
        { weightKg: 100, reps: 5, setNumber: 1 },
        { weightKg: 100, reps: 5, setNumber: 2 },
      ]),
    ],
    currentSessionSets: [],
    goalFocus: 'strength',
  });
  assert.equal(loadedOverload.adjustmentType, 'progressive_overload');
  assert.ok(loadedOverload.recommended.weightKg > 100);
  assert.equal(loadedOverload.recommended.reps, 5);

  // A loaded lift beating its target mid-session gets the same respect as a bodyweight one.
  const loadedMidSession = computeSmartProgression({
    exerciseName: 'Dumbbell Row',
    priorSessions: [],
    currentSessionSets: [{ weightKg: 40, reps: 14, setNumber: 1 }],
    goalFocus: 'hypertrophy',
  });
  assert.equal(loadedMidSession.recommended.reps, 14);

  // Falling short still aims at the target rather than locking in the shortfall.
  const underTarget = computeSmartProgression({
    exerciseName: 'Decline Push-Ups',
    priorSessions: [],
    currentSessionSets: [
      { weightKg: 0, reps: 20, setNumber: 1 },
      { weightKg: 0, reps: 11, setNumber: 2 },
    ],
    goalFocus: 'fat_loss',
  });
  assert.equal(underTarget.recommended.reps, 12);

  // Low recovery still deloads; the floor must not undo a deliberate back-off.
  const deload = computeSmartProgression({
    exerciseName: 'Back Squat',
    priorSessions: [],
    currentSessionSets: [{ weightKg: 100, reps: 20, setNumber: 1 }],
    goalFocus: 'fat_loss',
    recoveryScore: 40,
  });
  assert.equal(deload.adjustmentType, 'deload');
  assert.equal(deload.recommended.reps, 12);

  // Sets taken to failure are not proof of a repeatable rep count.
  const failureIgnored = computeSmartProgression({
    exerciseName: 'Decline Push-Ups',
    priorSessions: [
      session([
        { weightKg: 0, reps: 30, setNumber: 1, isFailure: true },
        { weightKg: 0, reps: 12, setNumber: 2 },
      ]),
    ],
    currentSessionSets: [],
    goalFocus: 'fat_loss',
  });
  assert.equal(failureIgnored.recommended.reps, 12);

  assert.deepEqual(parsePlannedRepRange('20-25'), { min: 20, max: 25 });
  assert.deepEqual(parsePlannedRepRange('12'), { min: 12, max: 12 });
  assert.deepEqual(parsePlannedRepRange('8-10 each side'), { min: 8, max: 10 });
  assert.deepEqual(parsePlannedRepRange('25-20'), { min: 25, max: 25 });
  assert.equal(parsePlannedRepRange('AMRAP'), undefined);
  assert.equal(parsePlannedRepRange('30 sec'), undefined);
  assert.equal(parsePlannedRepRange(undefined), undefined);

  console.log('smartProgressionEngine.test.ts — 22/22 PASS');
}

run();
