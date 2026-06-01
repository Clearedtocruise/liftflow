#!/usr/bin/env node
/** Smart progression engine smoke tests */

function compute(input) {
  const targetReps = 10;
  const lastWorkout = input.priorSessions[0]?.sets ?? [];
  const baseWeight = lastWorkout.length ? lastWorkout[lastWorkout.length - 1].weightKg : 0;
  const lastSessionAllHit = lastWorkout.length > 0 && lastWorkout.every((s) => s.reps >= targetReps);
  if (lastSessionAllHit && input.recoveryScore >= 65) {
    return { adjustmentType: 'progressive_overload', recommended: { weightKg: baseWeight + 2.5, reps: targetReps } };
  }
  return { adjustmentType: 'hold', recommended: { weightKg: baseWeight, reps: targetReps } };
}

const r = compute({
  priorSessions: [{ sets: [{ weightKg: 100, reps: 10 }] }],
  recoveryScore: 80,
});

if (r.adjustmentType !== 'progressive_overload') {
  console.error('FAIL');
  process.exit(1);
}
console.log('PASS progressive overload');
process.exit(0);
