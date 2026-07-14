import assert from 'node:assert/strict';

import {
    buildCoachInsights,
    buildTransformationStory,
    computeProgressPercent,
    resolveScheduleStatus,
} from './transformationStory';

function run() {
  assert.equal(computeProgressPercent(25, 20, 12), 38);

  const schedule = resolveScheduleStatus({
    progressPercent: 40,
    projectedWeeks: 12,
    paceKgPerWeek: 0.8,
    requiredFatLossKg: 8,
    currentBf: 20,
    goalBf: 12,
  });
  assert.equal(schedule.status, 'ahead');

  const insights = buildCoachInsights({
    progressPercent: 37,
    scheduleLabel: 'Ahead of schedule',
    weeksAhead: 3,
    nutritionAdherencePct: 82,
    goalBf: 12,
    estimatedCompletionDate: '2026-10-12',
  });
  assert.ok(insights.some((line) => line.includes('37%')));

  const story = buildTransformationStory(
    {
      id: '1',
      userId: 'u1',
      targetBodyFatPct: 12,
      current: { weightKg: 84, bodyFatPct: 25, leanMassKg: 63, fatMassKg: 21 },
      projected: { weightKg: 71.6, bodyFatPct: 12, leanMassKg: 63, fatMassKg: 8.6 },
      projectedWeeksToTarget: 16,
      nutritionAdherencePct: 80,
      workoutAdherencePct: 85,
      rationale: '',
      confidence: 'high',
      engineVersion: 'v1',
      createdAt: new Date().toISOString(),
    },
    [
      {
        id: 'm1',
        userId: 'u1',
        recordedAt: '2026-01-01T00:00:00Z',
        weightKg: 88,
        bodyFatPct: 28,
        createdAt: '2026-01-01T00:00:00Z',
      },
    ],
  );
  assert.ok(story.progressPercent > 0);
  assert.ok(story.milestones.length >= 3);
  assert.ok(story.coachInsights.length >= 2);

  console.log('transformationStory.test.ts — 5/5 PASS');
}

run();
