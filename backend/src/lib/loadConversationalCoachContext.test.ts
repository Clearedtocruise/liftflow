import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildContextSnapshot,
    type ConversationalCoachContext,
} from './loadConversationalCoachContext.js';
import { summarizeStrengthTrend } from './strengthTrend.js';

/**
 * `buildContextSnapshot` only reads fields, so a partial fixture is enough — and it keeps these
 * tests about "does real data reach the prompt" rather than about the loaders' database shapes.
 */
function fixture(overrides: Record<string, unknown> = {}): ConversationalCoachContext {
  const base = {
    userId: 'user-1',
    loadedAt: '2026-06-22T10:00:00.000Z',
    goals: { primary: 'muscle_gain', ranked: ['muscle_gain', 'strength'] },
    coachContext: {
      today: '2026-06-22',
      weightUnit: 'kg',
      limitations: [
        {
          bodyArea: 'shoulder',
          limitationType: 'impingement',
          painScore: 4,
          affectedMovements: ['overhead_press'],
          movementRestrictions: ['overhead'],
        },
      ],
      recentWorkouts: [
        { name: 'Push A', date: '2026-06-21T09:00:00.000Z', volume: 12400, sets: 18 },
        { name: 'Pull A', date: '2026-06-19T09:00:00.000Z', volume: 11800, sets: 17 },
      ],
      lastPerformance: [
        { exercise: 'Bench Press', weight: 102.5, reps: 5, date: '2026-06-21T09:30:00.000Z' },
        { exercise: 'Incline Press', weight: 70, reps: 8, date: '2026-06-21T09:50:00.000Z' },
      ],
      strengthTrend: summarizeStrengthTrend([
        { exercise: 'Bench Press', weight: 100, reps: 5, date: '2026-06-01T09:00:00.000Z' },
        { exercise: 'Bench Press', weight: 100, reps: 5, date: '2026-06-10T09:00:00.000Z' },
        { exercise: 'Bench Press', weight: 102.5, reps: 5, date: '2026-06-21T09:00:00.000Z' },
      ]),
      nutrition: {},
      macroTargets: { calories: 2900, proteinG: 185, rationale: 'Training day surplus.' },
      program: { name: 'Hypertrophy Block', currentWeek: 4, completionPct: 55, sprintPhase: 'accumulation' },
      recovery: {},
    },
    recovery: {
      recoveryScore: 68,
      recoveryStatus: 'moderate',
      trainingRecommendation: 'train_as_planned',
      suggestedMuscleGroups: ['back'],
      avoidMuscleGroups: ['chest'],
      factors: { workoutsLast7d: 4, consecutiveTrainingDays: 3, sleepHours: 6.5, sorenessLevel: 3 },
      trend: [
        { date: '2026-06-19', score: 61 },
        { date: '2026-06-20', score: 64 },
        { date: '2026-06-21', score: 68 },
      ],
    },
    workoutRecommendation: {
      today: {
        sessionLabel: 'Pull B',
        isRestDay: false,
        targetMuscles: ['back', 'biceps'],
        whySelected: ['Back is fully recovered.', 'Chest trained yesterday.'],
      },
      context: { adherencePct: 82 },
    },
    nutrition: {
      macroTargets: { calories: 2900, proteinG: 185, rationale: 'Training day surplus.' },
      intakeToday: { proteinG: 96 },
      gapAnalysis: { caloriesRemaining: 1150, proteinRemainingG: 89 },
      coachingTips: [{ message: 'Front-load protein at breakfast.' }],
      context: {
        trainingVolume7d: 48200,
        trainingVolumeBaseline7d: 44000,
        caloriesConsumedToday: 1750,
        adherencePct: 71,
        nutritionLogDays7d: 5,
        currentWeightKg: 82.4,
        weightTrend: 'gaining',
        weightDeltaKg: 0.6,
      },
    },
    outcome: {
      successScore: { overall_score: 74, score_category: 'on_track', life_improved: true },
      activeRiskFlags: [{ flag_type: 'sleep_debt' }],
      activeGoals: [{ id: 'g1' }, { id: 'g2' }],
    },
    progressPhotos: { totalCount: 3, latestDate: '2026-06-14', latestAngle: 'front', recentAngles: ['front'] },
    memory: {
      recentTurns: [
        { id: 't1', message: 'Why am I stalled?', topic: 'stalled', shortAnswer: 'Sleep is low.', createdAt: '2026-06-21T18:00:00.000Z' },
      ],
      topicCounts: { stalled: 1 },
      lastTopic: 'stalled',
      summary: 'Recent topics: stalled.',
    },
    ...overrides,
  };

  return base as unknown as ConversationalCoachContext;
}

test('the snapshot carries the weight unit and date the loaders resolved', () => {
  const snapshot = buildContextSnapshot(fixture());

  // Without these the model sees bare numbers like 102.5 and has to guess lb vs kg.
  assert.equal(snapshot.weightUnit, 'kg');
  assert.equal(snapshot.asOfDate, '2026-06-22');
});

test('active limitations reach the prompt', () => {
  const snapshot = buildContextSnapshot(fixture());

  assert.equal(snapshot.limitations.length, 1);
  assert.equal(snapshot.limitations[0].bodyArea, 'shoulder');
  assert.equal(snapshot.limitations[0].painScore, 4);
  assert.deepEqual(snapshot.limitations[0].affectedMovements, ['overhead_press']);
});

test('recent sessions and sets reach the prompt, not just the single latest set', () => {
  const snapshot = buildContextSnapshot(fixture());

  assert.deepEqual(
    snapshot.workoutHistory.recentSessions.map((s) => s.name),
    ['Push A', 'Pull A'],
  );
  assert.equal(snapshot.workoutHistory.recentSessions[0].volume, 12400);
  assert.equal(snapshot.workoutHistory.recentSets.length, 2);
  assert.equal(snapshot.workoutHistory.recentSets[0].date, '2026-06-21');
  assert.equal(snapshot.workoutHistory.lastExercise, 'Bench Press');
  assert.equal(snapshot.workoutHistory.consecutiveTrainingDays, 3);
});

test('the strength trend reaches the prompt with direction and span', () => {
  const snapshot = buildContextSnapshot(fixture());

  const bench = snapshot.strengthTrend.exercises[0];
  assert.equal(bench.exercise, 'Bench Press');
  assert.equal(bench.sessions, 3);
  assert.equal(bench.daysCovered, 20);
  assert.equal(bench.from, '100x5');
  assert.equal(bench.to, '102.5x5');
  assert.equal(bench.direction, 'up');
});

test('a stalled lift is named in the snapshot, not just implied by flat numbers', () => {
  const ctx = fixture();
  const snapshot = buildContextSnapshot(
    fixture({
      coachContext: {
        ...(ctx.coachContext as object),
        strengthTrend: summarizeStrengthTrend([
          { exercise: 'Bench Press', weight: 100, reps: 5, date: '2026-06-01T09:00:00.000Z' },
          { exercise: 'Bench Press', weight: 100, reps: 5, date: '2026-06-10T09:00:00.000Z' },
          { exercise: 'Bench Press', weight: 100, reps: 5, date: '2026-06-21T09:00:00.000Z' },
        ]),
      },
    }),
  );

  assert.equal(snapshot.strengthTrend.exercises[0].direction, 'flat');
  assert.deepEqual(snapshot.strengthTrend.stalledExercises, ['Bench Press']);
});

test('nutrition adherence, calories and remaining gaps reach the prompt', () => {
  const snapshot = buildContextSnapshot(fixture());

  assert.equal(snapshot.nutrition.caloriesTodayG, 1750);
  assert.equal(snapshot.nutrition.proteinTodayG, 96);
  assert.equal(snapshot.nutrition.caloriesRemaining, 1150);
  assert.equal(snapshot.nutrition.proteinRemainingG, 89);
  assert.equal(snapshot.nutrition.loggingAdherencePct, 71);
  assert.equal(snapshot.nutrition.loggedDaysLast7d, 5);
  assert.equal(snapshot.nutrition.targetRationale, 'Training day surplus.');
});

test('body weight trend reaches the prompt so progress is visible over time', () => {
  const snapshot = buildContextSnapshot(fixture());

  assert.deepEqual(snapshot.bodyWeight, { currentKg: 82.4, trend: 'gaining', deltaKg14d: 0.6 });
});

test('the recovery series reaches the prompt, not only the latest score', () => {
  const snapshot = buildContextSnapshot(fixture());

  assert.equal(snapshot.recovery.score, 68);
  assert.equal(snapshot.recovery.sleepHours, 6.5);
  assert.deepEqual(snapshot.recovery.avoidMuscles, ['chest']);
  assert.deepEqual(
    snapshot.recovery.recentScores.map((p) => p.score),
    [61, 64, 68],
  );
});

test('the active program reaches the prompt', () => {
  const snapshot = buildContextSnapshot(fixture());

  assert.equal(snapshot.program?.name, 'Hypertrophy Block');
  assert.equal(snapshot.program?.currentWeek, 4);
});

test('risk flags reach the prompt as names rather than only a count', () => {
  const snapshot = buildContextSnapshot(fixture());

  assert.deepEqual(snapshot.outcome.riskFlags, ['sleep_debt']);
  assert.equal(snapshot.outcome.successScore, 74);
});

test('long histories are capped so the prompt tail cannot be truncated away', () => {
  const manyWorkouts = Array.from({ length: 40 }, (_, i) => ({
    name: `Session ${i}`,
    date: '2026-06-01T09:00:00.000Z',
    volume: 1000,
    sets: 10,
  }));
  const manyTurns = Array.from({ length: 30 }, (_, i) => ({
    id: `t${i}`,
    message: 'q',
    topic: 'general',
    shortAnswer: 'a',
    createdAt: '2026-06-01T09:00:00.000Z',
  }));

  const ctx = fixture();
  const snapshot = buildContextSnapshot(
    fixture({
      coachContext: { ...(ctx.coachContext as object), recentWorkouts: manyWorkouts },
      memory: { ...(ctx.memory as object), recentTurns: manyTurns },
    }),
  );

  assert.equal(snapshot.workoutHistory.recentSessions.length, 5);
  assert.equal(snapshot.memory.recentTurns.length, 4);
});

test('an empty account produces a snapshot instead of throwing', () => {
  const ctx = fixture();
  const snapshot = buildContextSnapshot(
    fixture({
      coachContext: {
        ...(ctx.coachContext as object),
        limitations: [],
        recentWorkouts: [],
        lastPerformance: [],
        strengthTrend: summarizeStrengthTrend([]),
        program: undefined,
      },
      outcome: { successScore: null, activeRiskFlags: [], activeGoals: [] },
    }),
  );

  assert.deepEqual(snapshot.limitations, []);
  assert.deepEqual(snapshot.strengthTrend.exercises, []);
  assert.equal(snapshot.workoutHistory.lastExercise, undefined);
  assert.equal(snapshot.program, undefined);
  assert.equal(snapshot.outcome.successScore, undefined);
});
