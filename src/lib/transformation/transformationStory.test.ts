import assert from 'node:assert/strict';

import {
    buildCoachInsights,
    buildFatMassSeries,
    buildTransformationStory,
    computePaceKgPerWeek,
    computeProgressPercent,
    estimateMilestoneDate,
    MAX_WEEKLY_FAT_LOSS_FRACTION,
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
  bodyFatPct?: number,
): BodyCompositionRecord {
  return { id: recordedAt, userId: 'u1', recordedAt, weightKg, bodyFatPct } as BodyCompositionRecord;
}

/** Daily weigh-ins: one body-fat reading up front, then scale-only entries. */
function dailyWeighIns(
  startIso: string,
  days: number,
  startWeightKg: number,
  kgLostPerDay: number,
  startBodyFatPct: number,
  noiseKg = 0,
): BodyCompositionRecord[] {
  const start = new Date(startIso).getTime();
  const records: BodyCompositionRecord[] = [];
  for (let day = 0; day < days; day += 1) {
    const iso = new Date(start + day * 24 * 60 * 60 * 1000).toISOString();
    // Alternating noise mimics day-to-day water swings on a daily scale.
    const noise = noiseKg === 0 ? 0 : (day % 2 === 0 ? noiseKg : -noiseKg);
    const weightKg = Math.round((startWeightKg - kgLostPerDay * day + noise) * 100) / 100;
    records.push(measurement(iso, weightKg, day === 0 ? startBodyFatPct : undefined));
  }
  return records;
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

  // --- Daily weigh-ins with no body fat or waist logged ---

  const weighInNow = new Date('2026-07-31T12:00:00Z');
  const dailyOnly = dailyWeighIns('2026-07-01T07:00:00Z', 30, 85, 0.09, 20);

  // A single body-fat reading up front is enough; later scale-only days carry it forward.
  const series = buildFatMassSeries(dailyOnly);
  assert.equal(series.length, 30);
  assert.equal(series[0].derived, false);
  assert.equal(series[29].derived, true);
  assert.ok(series[29].fatMassKg < series[0].fatMassKg);

  const dailyPace = computePaceKgPerWeek(dailyOnly, { now: weighInNow });
  assert.ok(dailyPace != null && dailyPace > 0, 'daily weigh-ins should produce a pace');

  // Only part of a weight change is fat, and the rate is haircut, so the projected fat loss
  // must stay below the raw scale trend of ~0.63 kg/week.
  assert.ok(dailyPace! < 0.63, `pace ${dailyPace} should be conservative vs scale trend`);

  // Weight-only history still updates the hero rather than freezing at the last full entry.
  const dailyStory = buildTransformationStory(
    projection({
      current: { weightKg: 85, bodyFatPct: 20, leanMassKg: 68, fatMassKg: 17 },
      createdAt: '2026-07-01T00:00:00Z',
    }),
    dailyOnly,
    weighInNow,
  );
  assert.ok(dailyStory.currentWeightKg < 85, 'hero should follow the latest weigh-in');
  assert.ok(dailyStory.currentPaceKgPerWeek! > 0);
  assert.ok(dailyStory.daysRemaining != null);

  // Day-to-day water swings must not swing the projection.
  const noisy = dailyWeighIns('2026-07-01T07:00:00Z', 30, 85, 0.09, 20, 0.6);
  const noisyPace = computePaceKgPerWeek(noisy, { now: weighInNow });
  assert.ok(noisyPace != null);
  assert.ok(
    Math.abs(noisyPace! - dailyPace!) <= 0.15,
    `noise moved pace from ${dailyPace} to ${noisyPace}`,
  );

  // An early water-weight drop should not set the pace months later.
  const earlyWhoosh = [
    measurement('2026-01-01T00:00:00Z', 95, 26),
    measurement('2026-01-08T00:00:00Z', 91, 24),
    ...dailyWeighIns('2026-07-01T07:00:00Z', 30, 85, 0.03, 20),
  ];
  const windowedPace = computePaceKgPerWeek(earlyWhoosh, { now: weighInNow });
  assert.ok(windowedPace != null && windowedPace < 0.35, `stale whoosh leaked in: ${windowedPace}`);

  // Crash-diet weeks are capped rather than promised forward.
  const crash = dailyWeighIns('2026-07-01T07:00:00Z', 30, 85, 0.4, 25);
  const cappedPace = computePaceKgPerWeek(crash, { now: weighInNow });
  assert.ok(cappedPace != null);
  assert.ok(
    cappedPace! <= 85 * MAX_WEEKLY_FAT_LOSS_FRACTION + 0.05,
    `pace ${cappedPace} exceeded the weekly cap`,
  );

  // Gaining weight has no fat-loss pace, so the stored plan takes the timeline back.
  const gaining = dailyWeighIns('2026-07-01T07:00:00Z', 30, 80, -0.05, 18);
  assert.equal(computePaceKgPerWeek(gaining, { now: weighInNow }), undefined);

  // Waist is never required for any of this.
  assert.ok(dailyOnly.every((m) => m.waistCm == null));

  console.log('transformationStory.test.ts — all assertions passed');
}

run();
