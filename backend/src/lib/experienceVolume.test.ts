import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BEGINNER_RAMP_WEEKS,
  capSetsForExperience,
  normalizeExperience,
  resolveExperienceVolume,
} from './experienceVolume.js';

test('a beginner starts at two working sets', () => {
  const profile = resolveExperienceVolume('beginner', 1);
  assert.equal(profile.maxSetsPerExercise, 2);
  // The blueprint asks for 4 on almost every slot; a first-timer must not receive that.
  assert.equal(capSetsForExperience(4, profile), 2);
});

test('a beginner ramps to three sets after the acclimation block', () => {
  const during = resolveExperienceVolume('beginner', BEGINNER_RAMP_WEEKS);
  const after = resolveExperienceVolume('beginner', BEGINNER_RAMP_WEEKS + 1);
  assert.equal(capSetsForExperience(4, during), 2);
  assert.equal(capSetsForExperience(4, after), 3);
});

test('experience levels form a non-decreasing volume ladder', () => {
  const ladder = (['beginner', 'intermediate', 'advanced', 'elite'] as const).map(
    (level) => resolveExperienceVolume(level, 1).maxSetsPerExercise,
  );
  assert.deepEqual(ladder, [2, 3, 4, 5]);
  for (let i = 1; i < ladder.length; i++) {
    assert.ok(ladder[i]! >= ladder[i - 1]!);
  }
});

test('an advanced lifter keeps the full blueprint prescription', () => {
  const profile = resolveExperienceVolume('advanced', 1);
  assert.equal(capSetsForExperience(4, profile), 4);
  assert.equal(capSetsForExperience(3, profile), 3);
});

test('the cap never inflates an already-light prescription', () => {
  // A deliberate 2-set finisher stays a 2-set finisher for an advanced lifter.
  assert.equal(capSetsForExperience(2, resolveExperienceVolume('advanced', 1)), 2);
  assert.equal(capSetsForExperience(1, resolveExperienceVolume('elite', 1)), 1);
});

test('beginners get fewer exercises per session than advanced lifters', () => {
  const beginner = resolveExperienceVolume('beginner', 1);
  const advanced = resolveExperienceVolume('advanced', 1);
  assert.ok(beginner.maxExercisesPerSession < advanced.maxExercisesPerSession);
});

test('every level explains its prescription to the user', () => {
  for (const level of ['beginner', 'intermediate', 'advanced', 'elite'] as const) {
    const { rationale } = resolveExperienceVolume(level, 1);
    assert.ok(rationale.length > 0, `${level} needs a rationale`);
  }
});

test('unknown or missing experience falls back to intermediate', () => {
  assert.equal(normalizeExperience(undefined), 'intermediate');
  assert.equal(normalizeExperience(null), 'intermediate');
  assert.equal(normalizeExperience('nonsense'), 'intermediate');
  assert.equal(normalizeExperience('elite'), 'elite');
});

test('a beginner week stays within a sustainable working-set budget', () => {
  const profile = resolveExperienceVolume('beginner', 1);
  const weeklySets = profile.maxSetsPerExercise * profile.maxExercisesPerSession * 3;
  // Three sessions at the entry dose should land near the volume associated with the largest
  // all-cause mortality risk reduction, not at an advanced lifter's workload.
  assert.ok(weeklySets <= 45, `beginner weekly sets too high: ${weeklySets}`);
});
