#!/usr/bin/env node
/**
 * Sprint 7.2 — Recovery Intelligence Engine unit tests (self-contained)
 */

const RECOVERY_MUSCLE_GROUPS = ['chest', 'back', 'legs', 'shoulders', 'biceps', 'triceps', 'core'];

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function scoreToRecoveryStatus(score) {
  if (score >= 85) return 'fully_recovered';
  if (score >= 60) return 'recovering';
  if (score >= 40) return 'fatigued';
  return 'overtrained';
}

function statusLabel(status) {
  return (
    {
      fully_recovered: 'Fully Recovered',
      recovering: 'Recovering',
      fatigued: 'Fatigued',
      overtrained: 'Overtrained',
    }[status] ?? status
  );
}

function trainingRecommendationLabel(rec) {
  return (
    { train: 'Train', train_light: 'Train Light', recovery_session: 'Recovery Session', rest_day: 'Rest Day' }[rec] ??
    rec
  );
}

function normalizeToTrackedMuscles(mg) {
  switch (mg.toLowerCase()) {
    case 'chest':
      return ['chest'];
    case 'back':
      return ['back'];
    case 'shoulders':
      return ['shoulders'];
    case 'biceps':
      return ['biceps'];
    case 'triceps':
      return ['triceps'];
    case 'core':
      return ['core'];
    case 'arms':
      return ['biceps', 'triceps'];
    case 'quads':
    case 'glutes':
    case 'hamstrings':
    case 'calves':
    case 'legs':
      return ['legs'];
    default:
      return [];
  }
}

function computeMuscleRecovery(sessions7d, globalSoreness, now = Date.now()) {
  const accum = Object.fromEntries(RECOVERY_MUSCLE_GROUPS.map((m) => [m, { volume: 0, sets: 0, lastTrainedAt: undefined }]));

  for (const session of sessions7d) {
    for (const raw of session.muscleGroups) {
      for (const muscle of normalizeToTrackedMuscles(raw)) {
        accum[muscle].volume += session.volumeByMuscle[raw] ?? session.totalVolume / Math.max(1, session.muscleGroups.length);
        accum[muscle].sets += session.setsByMuscle[raw] ?? 0;
        if (!accum[muscle].lastTrainedAt || session.startedAt > accum[muscle].lastTrainedAt) {
          accum[muscle].lastTrainedAt = session.startedAt;
        }
      }
    }
  }

  return RECOVERY_MUSCLE_GROUPS.map((muscle) => {
    const data = accum[muscle];
    let score = 100;
    const hours = data.lastTrainedAt ? Math.max(0, (now - new Date(data.lastTrainedAt).getTime()) / 3600000) : undefined;
    if (hours != null) {
      if (hours < 24) score -= 38;
      else if (hours < 48) score -= 18;
      else if (hours < 72) score -= 10;
    } else score = 98;
    if (data.volume > 12000) score -= 12;
    if (globalSoreness >= 6) score -= 8;
    score = clamp(Math.round(score), 0, 100);
    return { muscle, score, hoursSinceTraining: hours != null ? Math.round(hours) : undefined };
  });
}

function countConsecutiveTrainingDays(sessionDates) {
  if (sessionDates.length === 0) return 0;
  const uniqueDays = [...new Set(sessionDates.map((d) => d.slice(0, 10)))].sort().reverse();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);
  let startOffset = 0;
  if (uniqueDays[0] !== todayStr) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (uniqueDays[0] !== yesterday.toISOString().slice(0, 10)) return 0;
    startOffset = 1;
  }
  let streak = 0;
  for (let i = 0; i < uniqueDays.length; i++) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - (i + startOffset));
    if (uniqueDays[i] === expected.toISOString().slice(0, 10)) streak += 1;
    else break;
  }
  return streak;
}

function computeTrainingLoadScore(sessionCount3d, totalVolume3d, consecutiveDays) {
  let score = 100;
  if (sessionCount3d >= 4) score -= 25;
  else if (sessionCount3d >= 3) score -= 12;
  if (totalVolume3d > 50000) score -= 22;
  if (consecutiveDays >= 4) score -= 12;
  return clamp(Math.round(score), 0, 100);
}

function computeRecoveryIntelligence(input) {
  const sessionCount3d = input.sessions3d.length;
  const totalVolume3d = input.sessions3d.reduce((s, x) => s + x.totalVolume, 0);
  const trainingLoadScore = computeTrainingLoadScore(sessionCount3d, totalVolume3d, input.consecutiveTrainingDays);
  const muscleRecovery = computeMuscleRecovery(input.sessions7d, input.checkIn?.sorenessLevel);
  const muscleReadinessScore = Math.round(muscleRecovery.reduce((s, m) => s + m.score, 0) / muscleRecovery.length);
  const subjectiveScore = input.checkIn?.recoveryScore ?? 72;
  const recoveryScore = clamp(Math.round(subjectiveScore * 0.45 + trainingLoadScore * 0.3 + muscleReadinessScore * 0.25), 0, 100);
  const recoveryStatus = scoreToRecoveryStatus(recoveryScore);
  let trainingRecommendation = 'train';
  if (recoveryScore < 40 || input.consecutiveTrainingDays >= 5) trainingRecommendation = 'rest_day';
  else if (recoveryScore < 55) trainingRecommendation = 'recovery_session';
  else if (recoveryScore < 75 || muscleReadinessScore < 62) trainingRecommendation = 'train_light';
  return {
    recoveryScore,
    recoveryStatus,
    recoveryStatusLabel: statusLabel(recoveryStatus),
    trainingRecommendation,
    trainingRecommendationLabel: trainingRecommendationLabel(trainingRecommendation),
    muscleRecovery,
    voiceRecoveryLine: `Your recovery score is ${recoveryScore} out of 100.`,
    voiceTrainTodayLine: 'Train based on your freshest muscle groups today.',
  };
}

const checks = [];
function pass(n, d = '') {
  checks.push({ n, s: 'PASS', d });
  console.log(`  ✓ ${n}${d ? ' — ' + d : ''}`);
}
function fail(n, d = '') {
  checks.push({ n, s: 'FAIL', d });
  console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`);
}

console.log('=== Recovery Intelligence Engine Tests ===\n');

if (scoreToRecoveryStatus(90) === 'fully_recovered') pass('Status 90');
else fail('Status 90');
if (scoreToRecoveryStatus(30) === 'overtrained') pass('Status 30');
else fail('Status 30');

const streak = countConsecutiveTrainingDays([
  new Date().toISOString(),
  new Date(Date.now() - 86400000).toISOString(),
]);
if (streak >= 1) pass('Consecutive days', String(streak));
else fail('Consecutive days');

const sessions3d = [
  { startedAt: new Date().toISOString(), totalVolume: 18000, muscleGroups: ['chest'], setsByMuscle: { chest: 12 }, volumeByMuscle: { chest: 18000 } },
  { startedAt: new Date(Date.now() - 86400000).toISOString(), totalVolume: 16000, muscleGroups: ['back'], setsByMuscle: { back: 14 }, volumeByMuscle: { back: 16000 } },
  { startedAt: new Date(Date.now() - 2 * 86400000).toISOString(), totalVolume: 14000, muscleGroups: ['legs'], setsByMuscle: { legs: 16 }, volumeByMuscle: { legs: 14000 } },
  { startedAt: new Date(Date.now() - 3 * 86400000).toISOString(), totalVolume: 12000, muscleGroups: ['shoulders'], setsByMuscle: { shoulders: 10 }, volumeByMuscle: { shoulders: 12000 } },
];

const heavy = computeRecoveryIntelligence({
  checkIn: { sorenessLevel: 6, recoveryScore: 68 },
  sessions7d: sessions3d,
  sessions3d,
  consecutiveTrainingDays: 4,
});
if (heavy.recoveryScore < 75) pass('Heavy load lowers score', String(heavy.recoveryScore));
else fail('Heavy load lowers score', String(heavy.recoveryScore));

const muscles = computeMuscleRecovery([
  {
    startedAt: new Date().toISOString(),
    totalVolume: 10000,
    muscleGroups: ['chest'],
    setsByMuscle: { chest: 15 },
    volumeByMuscle: { chest: 10000 },
  },
], 7);
const chest = muscles.find((m) => m.muscle === 'chest');
const legs = muscles.find((m) => m.muscle === 'legs');
if (chest && legs && chest.score < legs.score) pass('Chest fatigued vs fresh legs');
else fail('Per-muscle recency');

if (muscles.length === 7) pass('Seven muscle groups');
else fail('Muscle group count');

const rested = computeRecoveryIntelligence({
  checkIn: { recoveryScore: 88, sorenessLevel: 2 },
  sessions7d: [],
  sessions3d: [],
  consecutiveTrainingDays: 0,
});
if (rested.recoveryScore >= 75 && rested.trainingRecommendation === 'train') pass('Rested athlete → Train', String(rested.recoveryScore));
else fail('Rested athlete', `${rested.recoveryScore} ${rested.trainingRecommendation}`);

const failed = checks.filter((c) => c.s === 'FAIL').length;
console.log(`\n=== Summary: ${checks.length - failed}/${checks.length} PASS ===`);
process.exit(failed ? 1 : 0);
