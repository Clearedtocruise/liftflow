import assert from 'node:assert/strict';

import { computeSmartProgression } from './smartProgressionEngine';

function run() {
  // Mirrors backend/src/lib/smartProgressionEngine.test.ts — the two engines must agree.
  const midSession = computeSmartProgression({
    exerciseName: 'Decline Push-Ups',
    priorSessions: [],
    currentSessionSets: [{ weightKg: 0, reps: 20, setNumber: 1 }],
    goalFocus: 'fat_loss',
  });
  assert.equal(midSession.recommended.reps, 20);
  assert.equal(midSession.voiceNextSetLine, 'Aim for 20 reps.');

  const crossSession = computeSmartProgression({
    exerciseName: 'Decline Push-Ups',
    priorSessions: [
      {
        sessionId: 's1',
        sessionDate: '2026-10-01',
        sets: [
          { weightKg: 0, reps: 20, setNumber: 1 },
          { weightKg: 0, reps: 18, setNumber: 2 },
        ],
        totalVolume: 0,
      },
    ],
    currentSessionSets: [],
    goalFocus: 'fat_loss',
  });
  assert.equal(crossSession.recommended.reps, 21);
  assert.equal(crossSession.adjustmentType, 'rep_progression');

  const plannedRange = computeSmartProgression({
    exerciseName: 'Decline Push-Ups',
    priorSessions: [],
    currentSessionSets: [],
    goalFocus: 'fat_loss',
    plannedRepRange: { min: 20, max: 25 },
  });
  assert.equal(plannedRange.recommended.reps, 20);
  assert.deepEqual(plannedRange.targetRepRange, { min: 20, max: 25 });

  const loadedOverload = computeSmartProgression({
    exerciseName: 'Barbell Bench Press',
    priorSessions: [
      {
        sessionId: 's1',
        sessionDate: '2026-10-01',
        sets: [
          { weightKg: 100, reps: 5, setNumber: 1 },
          { weightKg: 100, reps: 5, setNumber: 2 },
        ],
        totalVolume: 1000,
      },
    ],
    currentSessionSets: [],
    goalFocus: 'strength',
  });
  assert.equal(loadedOverload.adjustmentType, 'progressive_overload');
  assert.ok(loadedOverload.recommended.weightKg > 100);
  assert.equal(loadedOverload.recommended.reps, 5);

  const deload = computeSmartProgression({
    exerciseName: 'Back Squat',
    priorSessions: [],
    currentSessionSets: [{ weightKg: 100, reps: 20, setNumber: 1 }],
    goalFocus: 'fat_loss',
    recoveryScore: 40,
  });
  assert.equal(deload.adjustmentType, 'deload');
  assert.equal(deload.recommended.reps, 12);

  console.log('smartProgressionEngine.bodyweightReps.test.ts — 12/12 PASS');
}

run();
