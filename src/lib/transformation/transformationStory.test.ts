import assert from 'node:assert/strict';

import {
    buildCoachInsights,
    buildTransformationStory,
    computeProgressPercent,
    estimateMilestoneDate,
    resolveCurrentSnapshot,
    resolveScheduleStatus,
    resolveTimelineWeeks,
} from './transformationStory';
import type { BodyCompositionRecord } from '@/types';
import type { TransformationProjection } from '@/types/transformation';

const LB = 2.2046226218;

function projection(overrides: Partial<TransformationProjection> = {}): TransformationProjection {
  return {
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
    ...overrides,
  };
}

function measurement(
  recordedAt: string,
  weightKg: number,
  bodyFatPct: number,
): BodyCompositionRecord {
  return { id: recordedAt, userId: 'u1', recordedAt, weightKg, bodyFatPct } as BodyCompositionRecord;
}

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

  const story = buildTransformationStory(projection(), [measurement('2026-01-01T00:00:00Z', 88, 28)]);
  assert.ok(story.progressPercent > 0);
  assert.ok(story.milestones.length >= 3);
  assert.ok(story.coachInsights.length >= 2);

  // Measured pace wins over the stored adherence plan, so the headline date cannot claim a
  // finish ~47 weeks after the milestone that reaches the same body fat.
  const paceTimeline = resolveTimelineWeeks({
    requiredFatLossKg: 5.9,
    paceKgPerWeek: 0.59,
    projectedWeeks: 56,
  });
  assert.equal(paceTimeline.source, 'pace');
  assert.ok(Math.abs(paceTimeline.weeks! - 10) < 0.5);

  const planTimeline = resolveTimelineWeeks({ requiredFatLossKg: 5.9, projectedWeeks: 56 });
  assert.equal(planTimeline.source, 'plan');
  assert.equal(planTimeline.weeks, 56);

  assert.equal(resolveTimelineWeeks({ requiredFatLossKg: 5.9 }).source, 'none');

  // The screenshot case: 183 lb @ 18% chasing 12%, losing ~1.3 lb/week.
  const now = new Date('2026-07-31T12:00:00Z');
  const screenshot = buildTransformationStory(
    projection({
      targetBodyFatPct: 12,
      current: { weightKg: 83, bodyFatPct: 18, leanMassKg: 68.06, fatMassKg: 14.94 },
      projected: { weightKg: 77.3, bodyFatPct: 12, leanMassKg: 68.06, fatMassKg: 9.28 },
      projectedWeeksToTarget: 56,
      createdAt: '2026-07-31T00:00:00Z',
    }),
    [
      measurement('2026-05-31T00:00:00Z', 88.1, 21.5),
      measurement('2026-07-30T00:00:00Z', 83, 18),
    ],
    now,
  );

  // ~5.7 kg to lose at ~0.6 kg/week is weeks, not 394 days.
  assert.ok(
    screenshot.daysRemaining! < 130,
    `expected a pace-based finish, got ${screenshot.daysRemaining} days`,
  );

  // The goal-body-fat milestone must land on the completion date, not a year before it.
  const goalMilestone = screenshot.milestones.find((m) => m.bodyFatPct === 12);
  assert.ok(goalMilestone?.estimatedDate);
  const milestoneTime = new Date(`${goalMilestone!.estimatedDate}T12:00:00Z`).getTime();
  const completionTime = new Date(`${screenshot.estimatedCompletionDate}T12:00:00Z`).getTime();
  const daysApart = Math.abs(milestoneTime - completionTime) / (24 * 60 * 60 * 1000);
  assert.ok(daysApart <= 2, `milestone and completion disagree by ${daysApart} days`);

  // A measurement logged after the projection run updates the headline immediately.
  const fresher = resolveCurrentSnapshot(
    { weightKg: 84, bodyFatPct: 25, leanMassKg: 63, fatMassKg: 21 },
    [measurement('2026-07-30T00:00:00Z', 80, 20)],
    '2026-07-01T00:00:00Z',
  );
  assert.equal(fresher.weightKg, 80);
  assert.equal(fresher.bodyFatPct, 20);

  // A measurement older than the run must not overwrite the run's snapshot.
  const stale = resolveCurrentSnapshot(
    { weightKg: 84, bodyFatPct: 25, leanMassKg: 63, fatMassKg: 21 },
    [measurement('2026-06-01T00:00:00Z', 90, 30)],
    '2026-07-01T00:00:00Z',
  );
  assert.equal(stale.weightKg, 84);

  const refreshed = buildTransformationStory(
    projection({ createdAt: '2026-07-01T00:00:00Z' }),
    [measurement('2026-07-30T00:00:00Z', 80, 20)],
    now,
  );
  assert.equal(refreshed.currentWeightKg, 80);
  assert.equal(refreshed.currentBodyFatPct, 20);
  // Goal weight follows the new lean mass instead of staying pinned to the old run.
  assert.ok(Math.abs(refreshed.goalWeightKg - 64 / (1 - 0.12)) < 1.5);

  // Milestones account for the weight lost with the fat.
  const milestoneDate = estimateMilestoneDate(18, 12, 0.59, 83, now);
  assert.ok(milestoneDate);
  const weeksOut =
    (new Date(`${milestoneDate}T12:00:00Z`).getTime() - now.getTime()) /
    (7 * 24 * 60 * 60 * 1000);
  assert.ok(weeksOut > 8 && weeksOut < 12, `expected ~9.6 weeks, got ${weeksOut}`);

  assert.ok(1.3 / LB > 0.55);

  console.log('transformationStory.test.ts — all assertions passed');
}

run();
