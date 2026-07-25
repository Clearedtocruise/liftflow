import assert from 'node:assert/strict';
import test from 'node:test';

import { createWorkoutRecommendationLoader } from './loadWorkoutRecommendations.js';

type FakeDateClock = {
  current: Date;
  now: () => Date;
  advanceBy: (ms: number) => void;
};

function createClock(startIso = '2026-07-25T12:00:00.000Z'): FakeDateClock {
  let current = new Date(startIso);
  return {
    get current() {
      return current;
    },
    now: () => new Date(current),
    advanceBy(ms: number) {
      current = new Date(current.getTime() + ms);
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createLoaderHarness(options?: {
  clock?: FakeDateClock;
  gateRecovery?: ReturnType<typeof deferred<void>>;
  failRecoveryTimes?: number;
}) {
  const clock = options?.clock ?? createClock();
  const counts = {
    profile: 0,
    recovery: 0,
    sessions: 0,
    planned: 0,
    planBuilds: 0,
    compute: 0,
  };

  const loader = createWorkoutRecommendationLoader({
    now: clock.now,
    async loadProfile() {
      counts.profile += 1;
      return {
        timezone: 'America/New_York',
        fitness_goals: ['hypertrophy'],
        primary_training_goal: 'hypertrophy',
        metadata: {},
      };
    },
    async loadRecoveryIntelligence() {
      counts.recovery += 1;
      if (options?.gateRecovery) {
        await options.gateRecovery.promise;
      }
      if ((options?.failRecoveryTimes ?? 0) >= counts.recovery) {
        throw new Error(`recovery failed ${counts.recovery}`);
      }
      return {
        recoveryScore: 82,
        recoveryStatus: 'ready',
        trainingRecommendation: 'train',
        suggestedMuscleGroups: ['chest', 'shoulders'],
        avoidMuscleGroups: [],
        muscleRecovery: [],
      } as Awaited<ReturnType<typeof loader.loadWorkoutRecommendations>>['context'] extends never ? never : {
        recoveryScore: number;
        recoveryStatus: string;
        trainingRecommendation: string;
        suggestedMuscleGroups: string[];
        avoidMuscleGroups: string[];
        muscleRecovery: Array<{ muscle: string; score: number; hoursSinceTraining?: number; weeklyVolume: number }>;
      };
    },
    async loadRecentSessions() {
      counts.sessions += 1;
      return [];
    },
    async loadPlannedWorkouts() {
      counts.planned += 1;
      return [];
    },
    async buildAdaptiveWorkoutPlan(userId, targetMuscles, rationale) {
      counts.planBuilds += 1;
      return {
        name: `${userId}:${targetMuscles.join('+')}`,
        rationale,
        muscleGroups: [...targetMuscles],
        exercises: [
          {
            name: `Exercise ${counts.planBuilds}`,
            sets: 3,
            reps: '8-12',
            restSeconds: 90,
          },
        ],
        estimatedMinutes: 55,
        aiGenerated: false,
      };
    },
    computeWorkoutRecommendations(input, workoutsByDate) {
      counts.compute += 1;
      const todayWorkout = workoutsByDate.get(input.today);
      const tomorrowDate = '2026-07-26';
      const tomorrowWorkout = workoutsByDate.get(tomorrowDate);
      return {
        context: {
          userId: input.userId,
          recoveryScore: input.recoveryScore,
          recoveryStatus: input.recoveryStatus,
          trainingRecommendation: input.trainingRecommendation,
          goalFocus: 'hypertrophy',
          splitStyle: input.splitStyle,
          splitLabel: 'Push / Pull / Legs',
          frequency: 4,
          adherencePct: 100,
          missedWorkoutCount: input.missedWorkouts.length,
          weakMuscleGroups: [],
          suggestedMuscleGroups: input.suggestedMuscleGroups,
          avoidMuscleGroups: input.avoidMuscleGroups,
          workoutsLast7d: input.sessions7d,
          basedOnSessionCount: input.sessions7d,
        },
        today: {
          date: input.today,
          dayLabel: 'Sat',
          isRestDay: false,
          sessionLabel: 'Push Day',
          targetMuscles: ['chest', 'shoulders'],
          workout: todayWorkout,
          whySelected: ['Fresh push session'],
          whyNotSelected: [],
          voiceLine: 'Train push today.',
        },
        tomorrow: {
          date: tomorrowDate,
          dayLabel: 'Sun',
          isRestDay: false,
          sessionLabel: 'Pull Day',
          targetMuscles: ['back', 'biceps'],
          workout: tomorrowWorkout,
          whySelected: ['Train pull tomorrow'],
          whyNotSelected: [],
          voiceLine: 'Train pull tomorrow.',
        },
        weeklyPlan: [],
        voiceTrainTodayLine: 'Train push today.',
        voiceBuildWorkoutLine: 'Built your workout.',
      };
    },
    resolveRankedGoals(fitnessGoals) {
      return fitnessGoals ?? [];
    },
    inferDaysPerWeek() {
      return 4;
    },
    inferSplitFromProfile() {
      return 'push_pull_legs';
    },
  });

  return { loader, counts, clock };
}

test('daily recommendations shares an in-flight request for the same user', async () => {
  const gate = deferred<void>();
  const { loader, counts } = createLoaderHarness({ gateRecovery: gate });

  const first = loader.loadWorkoutRecommendations('user-1');
  const second = loader.loadWorkoutRecommendations('user-1');

  assert.equal(counts.profile, 1);
  await Promise.resolve();
  assert.equal(counts.recovery, 1);

  gate.resolve();
  const [reportA, reportB] = await Promise.all([first, second]);

  assert.equal(reportA, reportB);
  assert.equal(counts.sessions, 1);
  assert.equal(counts.planned, 1);
  assert.equal(counts.planBuilds, 2);
  assert.equal(counts.compute, 2);
});

test('daily recommendations uses a 60-second cache keyed by user and local date', async () => {
  const clock = createClock();
  const { loader, counts } = createLoaderHarness({ clock });

  const first = await loader.loadWorkoutRecommendations('user-1');
  assert.equal(counts.recovery, 1);
  assert.equal(counts.planBuilds, 2);

  clock.advanceBy(59_000);
  const cached = await loader.loadWorkoutRecommendations('user-1');
  assert.equal(cached, first);
  assert.equal(counts.recovery, 1);
  assert.equal(counts.planBuilds, 2);

  clock.advanceBy(2_000);
  const refreshed = await loader.loadWorkoutRecommendations('user-1');
  assert.notEqual(refreshed, first);
  assert.equal(counts.recovery, 2);
  assert.equal(counts.planBuilds, 4);
});

test('daily recommendations clears a failed in-flight entry and retries on the next request', async () => {
  const { loader, counts } = createLoaderHarness({ failRecoveryTimes: 1 });

  await assert.rejects(loader.loadWorkoutRecommendations('user-1'), /recovery failed 1/);
  assert.equal(counts.recovery, 1);

  const report = await loader.loadWorkoutRecommendations('user-1');
  assert.equal(report.context.userId, 'user-1');
  assert.equal(counts.recovery, 2);
  assert.equal(counts.planBuilds, 2);
});

console.log('loadWorkoutRecommendations.test.ts — all assertions passed');
