import {
  calculateRecoveryScore,
  describeSubjectiveInputs,
  mergeTrainingLoadScore,
  type DailyRecoveryInput,
  type SubjectiveInputKey,
} from './recoveryScore.js';

export type RecoveryIntelligenceStatus = 'fully_recovered' | 'recovering' | 'fatigued' | 'overtrained';

export type TrainingDayRecommendation = 'train' | 'train_light' | 'recovery_session' | 'rest_day';

export type RecoveryMuscleGroup = 'chest' | 'back' | 'legs' | 'shoulders' | 'biceps' | 'triceps' | 'core';

export const RECOVERY_MUSCLE_GROUPS: RecoveryMuscleGroup[] = [
  'chest',
  'back',
  'legs',
  'shoulders',
  'biceps',
  'triceps',
  'core',
];

const MUSCLE_LABELS: Record<RecoveryMuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  legs: 'Legs',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  core: 'Core',
};

export type SessionMuscleLoad = {
  sessionId: string;
  startedAt: string;
  durationSeconds: number;
  totalVolume: number;
  muscleGroups: string[];
  setsByMuscle: Record<string, number>;
  volumeByMuscle: Record<string, number>;
};

export const RECOVERY_COMPOSITE_WEIGHTS = {
  subjective: 0.45,
  trainingLoad: 0.3,
  muscleReadiness: 0.25,
} as const;

export type RecoveryInputSource = 'check_in' | 'health_kit' | 'default_estimate';

export type RecoveryTransparency = {
  recoveryFormula: {
    subjectiveWeight: number;
    trainingLoadWeight: number;
    muscleReadinessWeight: number;
    trendAdjustment: number;
    description: string;
  };
  readinessFormula: {
    description: string;
    muscleCount: number;
    defaultWhenNoData: number;
  };
  subjectiveInputs: Array<{
    key: string;
    label: string;
    weight: number;
    score: number;
    provided: boolean;
    source: RecoveryInputSource;
  }>;
  dataSources: {
    checkIn: boolean;
    healthKitSleep: boolean;
    workoutSessions7d: number;
    workoutSessions3d: number;
    trendDays: number;
  };
  estimatedFromDefaults: boolean;
  missingInputs: string[];
};

export type RecoveryIntelligenceInput = {
  checkIn?: DailyRecoveryInput & { recoveryScore?: number; recoveryModeActive?: boolean };
  inputSources?: Partial<Record<SubjectiveInputKey, 'check_in' | 'health_kit'>>;
  sessions7d: SessionMuscleLoad[];
  sessions3d: SessionMuscleLoad[];
  consecutiveTrainingDays: number;
  trendScores?: Array<{ date: string; score: number }>;
  sleepDataAvailable?: boolean;
  healthKitAvailable?: boolean;
};

export type MuscleRecoveryState = {
  muscle: RecoveryMuscleGroup;
  label: string;
  score: number;
  status: RecoveryIntelligenceStatus;
  lastTrainedAt?: string;
  hoursSinceTraining?: number;
  weeklyVolume: number;
  weeklySets: number;
};

export type RecoveryIntelligenceReport = {
  assessedAt: string;
  recoveryScore: number;
  recoveryStatus: RecoveryIntelligenceStatus;
  recoveryStatusLabel: string;
  trainingRecommendation: TrainingDayRecommendation;
  trainingRecommendationLabel: string;
  rationale: string;
  voiceRecoveryLine: string;
  voiceTrainTodayLine: string;
  muscleRecovery: MuscleRecoveryState[];
  suggestedMuscleGroups: RecoveryMuscleGroup[];
  avoidMuscleGroups: RecoveryMuscleGroup[];
  factors: {
    subjectiveScore: number;
    trainingLoadScore: number;
    muscleReadinessScore: number;
    sessionCount3d: number;
    totalVolume3d: number;
    consecutiveTrainingDays: number;
    avgSessionDurationMin: number;
    workoutsLast7d: number;
    sleepHours?: number;
    sorenessLevel?: number;
    sleepDataAvailable: boolean;
    healthKitAvailable: boolean;
  };
  transparency: RecoveryTransparency;
  trend: Array<{ date: string; score: number; status: RecoveryIntelligenceStatus }>;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeToTrackedMuscles(muscleGroup: string): RecoveryMuscleGroup[] {
  const mg = muscleGroup.toLowerCase();
  switch (mg) {
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

export function scoreToRecoveryStatus(score: number): RecoveryIntelligenceStatus {
  if (score >= 85) return 'fully_recovered';
  if (score >= 60) return 'recovering';
  if (score >= 40) return 'fatigued';
  return 'overtrained';
}

export function statusLabel(status: RecoveryIntelligenceStatus): string {
  switch (status) {
    case 'fully_recovered':
      return 'Fully Recovered';
    case 'recovering':
      return 'Recovering';
    case 'fatigued':
      return 'Fatigued';
    case 'overtrained':
      return 'Overtrained';
  }
}

export function trainingRecommendationLabel(rec: TrainingDayRecommendation): string {
  switch (rec) {
    case 'train':
      return 'Train';
    case 'train_light':
      return 'Train Light';
    case 'recovery_session':
      return 'Recovery Session';
    case 'rest_day':
      return 'Rest Day';
  }
}

function computeTrainingLoadScore(
  sessionCount3d: number,
  totalVolume3d: number,
  consecutiveDays: number,
  avgDurationMin: number,
): number {
  let score = 100;
  if (sessionCount3d >= 4) score -= 25;
  else if (sessionCount3d >= 3) score -= 12;
  if (totalVolume3d > 50000) score -= 22;
  else if (totalVolume3d > 30000) score -= 12;
  else if (totalVolume3d > 15000) score -= 6;
  if (consecutiveDays >= 5) score -= 20;
  else if (consecutiveDays >= 4) score -= 12;
  else if (consecutiveDays >= 3) score -= 6;
  if (avgDurationMin > 90) score -= 10;
  else if (avgDurationMin > 75) score -= 5;
  return clamp(Math.round(score), 0, 100);
}

function hoursSince(isoDate: string, now = Date.now()): number {
  return Math.max(0, (now - new Date(isoDate).getTime()) / (1000 * 60 * 60));
}

export function computeMuscleRecovery(
  sessions7d: SessionMuscleLoad[],
  globalSoreness?: number,
  now = Date.now(),
): MuscleRecoveryState[] {
  const accum: Record<
    RecoveryMuscleGroup,
    { volume: number; sets: number; lastTrainedAt?: string }
  > = Object.fromEntries(
    RECOVERY_MUSCLE_GROUPS.map((m) => [m, { volume: 0, sets: 0, lastTrainedAt: undefined }]),
  ) as Record<RecoveryMuscleGroup, { volume: number; sets: number; lastTrainedAt?: string }>;

  for (const session of sessions7d) {
    for (const raw of session.muscleGroups) {
      for (const muscle of normalizeToTrackedMuscles(raw)) {
        accum[muscle].volume += session.volumeByMuscle[raw] ?? session.totalVolume / Math.max(1, session.muscleGroups.length);
        accum[muscle].sets += session.setsByMuscle[raw] ?? 0;
        if (!accum[muscle].lastTrainedAt || session.startedAt > accum[muscle].lastTrainedAt!) {
          accum[muscle].lastTrainedAt = session.startedAt;
        }
      }
    }
  }

  return RECOVERY_MUSCLE_GROUPS.map((muscle) => {
    const data = accum[muscle];
    let score = 100;
    const hours = data.lastTrainedAt ? hoursSince(data.lastTrainedAt, now) : undefined;

    if (hours != null) {
      if (hours < 24) score -= 38;
      else if (hours < 36) score -= 28;
      else if (hours < 48) score -= 18;
      else if (hours < 72) score -= 10;
      else if (hours < 96) score -= 4;
    } else {
      score = 98;
    }

    if (data.volume > 20000) score -= 18;
    else if (data.volume > 12000) score -= 12;
    else if (data.volume > 6000) score -= 6;

    if (data.sets > 20) score -= 8;
    else if (data.sets > 12) score -= 4;

    if (globalSoreness != null) {
      if (globalSoreness >= 8) score -= 14;
      else if (globalSoreness >= 6) score -= 8;
      else if (globalSoreness >= 4) score -= 3;
    }

    score = clamp(Math.round(score), 0, 100);
    return {
      muscle,
      label: MUSCLE_LABELS[muscle],
      score,
      status: scoreToRecoveryStatus(score),
      lastTrainedAt: data.lastTrainedAt,
      hoursSinceTraining: hours != null ? Math.round(hours) : undefined,
      weeklyVolume: Math.round(data.volume),
      weeklySets: data.sets,
    };
  });
}

function resolveTrainingRecommendation(
  recoveryScore: number,
  muscleReadinessScore: number,
  consecutiveDays: number,
  recoveryModeActive: boolean,
): TrainingDayRecommendation {
  if (recoveryScore < 40 || consecutiveDays >= 5) return 'rest_day';
  if (recoveryScore < 55 || recoveryModeActive) return 'recovery_session';
  if (recoveryScore < 75 || muscleReadinessScore < 62) return 'train_light';
  return 'train';
}

function pickSuggestedMuscles(muscles: MuscleRecoveryState[]): RecoveryMuscleGroup[] {
  return [...muscles]
    .sort((a, b) => b.score - a.score)
    .filter((m) => m.score >= 65)
    .slice(0, 3)
    .map((m) => m.muscle);
}

function pickAvoidMuscles(muscles: MuscleRecoveryState[]): RecoveryMuscleGroup[] {
  return muscles.filter((m) => m.score < 50).map((m) => m.muscle);
}

function buildRationale(
  status: RecoveryIntelligenceStatus,
  trainingRec: TrainingDayRecommendation,
  factors: RecoveryIntelligenceReport['factors'],
  suggested: RecoveryMuscleGroup[],
): string {
  const parts: string[] = [];

  if (factors.consecutiveTrainingDays >= 4) {
    parts.push(`${factors.consecutiveTrainingDays} consecutive training days detected.`);
  }
  if (factors.sessionCount3d >= 3) {
    parts.push(`${factors.sessionCount3d} sessions in the last 3 days with ${Math.round(factors.totalVolume3d).toLocaleString()} total volume.`);
  }
  if (factors.sorenessLevel != null && factors.sorenessLevel >= 6) {
    parts.push(`Reported soreness is elevated (${factors.sorenessLevel}/10).`);
  }
  if (factors.sleepHours != null && factors.sleepHours < 6) {
    parts.push(`Sleep was short (${factors.sleepHours}h) — recovery may be compromised.`);
  }

  if (parts.length === 0) {
    parts.push('Training load and subjective signals are within a manageable range.');
  }

  if (trainingRec === 'train' && suggested.length > 0) {
    parts.push(`Best targets today: ${suggested.map((m) => MUSCLE_LABELS[m]).join(', ')}.`);
  } else if (trainingRec === 'rest_day') {
    parts.push('Prioritize sleep, hydration, and complete rest.');
  } else if (trainingRec === 'recovery_session') {
    parts.push('Light mobility, walking, or technique work only.');
  } else if (trainingRec === 'train_light') {
    parts.push('Reduce volume 20–30% and avoid failure sets.');
  }

  parts.push(`Overall status: ${statusLabel(status)}.`);
  return parts.join(' ');
}

const MUSCLE_READINESS_DEFAULT = 75;

function buildTransparency(
  input: RecoveryIntelligenceInput,
  subjectiveDescription: ReturnType<typeof describeSubjectiveInputs>,
  trendAdjustment: number,
  muscleRecovery: MuscleRecoveryState[],
): RecoveryTransparency {
  const sources = input.inputSources ?? {};

  const subjectiveInputs = subjectiveDescription.breakdown.map((row) => ({
    ...row,
    source: row.provided
      ? (sources[row.key] ?? 'check_in')
      : ('default_estimate' as RecoveryInputSource),
  }));

  return {
    recoveryFormula: {
      subjectiveWeight: RECOVERY_COMPOSITE_WEIGHTS.subjective,
      trainingLoadWeight: RECOVERY_COMPOSITE_WEIGHTS.trainingLoad,
      muscleReadinessWeight: RECOVERY_COMPOSITE_WEIGHTS.muscleReadiness,
      trendAdjustment,
      description:
        'Recovery % = 45% subjective check-in + 30% training load + 25% muscle readiness ± trend adjustment',
    },
    readinessFormula: {
      description:
        'Readiness % = average per-muscle score from hours since last trained, 7-day volume/sets, and soreness',
      muscleCount: muscleRecovery.length,
      defaultWhenNoData: MUSCLE_READINESS_DEFAULT,
    },
    subjectiveInputs,
    dataSources: {
      checkIn: Boolean(input.checkIn && Object.keys(input.checkIn).length > 0),
      healthKitSleep: sources.sleepHours === 'health_kit',
      workoutSessions7d: input.sessions7d.length,
      workoutSessions3d: input.sessions3d.length,
      trendDays: input.trendScores?.length ?? 0,
    },
    estimatedFromDefaults: subjectiveDescription.estimatedFromDefaults,
    missingInputs: subjectiveDescription.missingInputs,
  };
}

export function computeRecoveryIntelligence(input: RecoveryIntelligenceInput): RecoveryIntelligenceReport {
  const sessionCount3d = input.sessions3d.length;
  const totalVolume3d = input.sessions3d.reduce((s, x) => s + x.totalVolume, 0);
  const avgSessionDurationMin =
    input.sessions7d.length > 0
      ? input.sessions7d.reduce((s, x) => s + x.durationSeconds, 0) / input.sessions7d.length / 60
      : 0;

  const subjectiveResult = calculateRecoveryScore(input.checkIn ?? {});
  const subjectiveDescription = describeSubjectiveInputs(input.checkIn ?? {});
  const subjectiveScore =
    input.checkIn?.recoveryScore ??
    mergeTrainingLoadScore(subjectiveResult.recoveryScore, sessionCount3d, totalVolume3d);

  const trainingLoadScore = computeTrainingLoadScore(
    sessionCount3d,
    totalVolume3d,
    input.consecutiveTrainingDays,
    avgSessionDurationMin,
  );

  const muscleRecovery = computeMuscleRecovery(input.sessions7d, input.checkIn?.sorenessLevel);
  const muscleReadinessScore =
    muscleRecovery.length > 0
      ? Math.round(muscleRecovery.reduce((s, m) => s + m.score, 0) / muscleRecovery.length)
      : MUSCLE_READINESS_DEFAULT;

  const trendAdjustment =
    input.trendScores && input.trendScores.length >= 2
      ? Math.round(
          ((input.trendScores[input.trendScores.length - 1]?.score ?? subjectiveScore) -
            (input.trendScores[0]?.score ?? subjectiveScore)) *
            0.05,
        )
      : 0;

  const recoveryScore = clamp(
    Math.round(subjectiveScore * 0.45 + trainingLoadScore * 0.3 + muscleReadinessScore * 0.25 + trendAdjustment),
    0,
    100,
  );

  const recoveryStatus = scoreToRecoveryStatus(recoveryScore);
  const recoveryModeActive = recoveryScore < 40 || input.checkIn?.recoveryModeActive === true;
  const trainingRecommendation = resolveTrainingRecommendation(
    recoveryScore,
    muscleReadinessScore,
    input.consecutiveTrainingDays,
    recoveryModeActive,
  );

  const suggestedMuscleGroups = pickSuggestedMuscles(muscleRecovery);
  const avoidMuscleGroups = pickAvoidMuscles(muscleRecovery);

  const factors = {
    subjectiveScore,
    trainingLoadScore,
    muscleReadinessScore,
    sessionCount3d,
    totalVolume3d,
    consecutiveTrainingDays: input.consecutiveTrainingDays,
    avgSessionDurationMin: Math.round(avgSessionDurationMin),
    workoutsLast7d: input.sessions7d.length,
    sleepHours: input.checkIn?.sleepHours,
    sorenessLevel: input.checkIn?.sorenessLevel,
    sleepDataAvailable: input.sleepDataAvailable ?? false,
    healthKitAvailable: input.healthKitAvailable ?? false,
  };

  const rationale = buildRationale(recoveryStatus, trainingRecommendation, factors, suggestedMuscleGroups);

  const transparency = buildTransparency(input, subjectiveDescription, trendAdjustment, muscleRecovery);

  const voiceRecoveryLine = `Your recovery score is ${recoveryScore} out of 100. You're ${statusLabel(recoveryStatus).toLowerCase()}. ${trainingRecommendationLabel(trainingRecommendation)} is recommended today.`;

  const voiceTrainTodayLine =
    suggestedMuscleGroups.length > 0
      ? `Train ${suggestedMuscleGroups.map((m) => MUSCLE_LABELS[m]).join(' and ')} today. ${avoidMuscleGroups.length > 0 ? `Avoid heavy ${avoidMuscleGroups.map((m) => MUSCLE_LABELS[m]).join(' and ')} work.` : ''}`.trim()
      : trainingRecommendation === 'rest_day'
        ? 'Take a rest day. Your body needs more recovery before hard training.'
        : trainingRecommendation === 'recovery_session'
          ? 'Do a light recovery session — mobility, walking, or easy cardio only.'
          : 'Keep today lighter — reduce volume and focus on quality movement.';

  const trend =
    input.trendScores?.map((point) => ({
      date: point.date,
      score: point.score,
      status: scoreToRecoveryStatus(point.score),
    })) ?? [];

  return {
    assessedAt: new Date().toISOString(),
    recoveryScore,
    recoveryStatus,
    recoveryStatusLabel: statusLabel(recoveryStatus),
    trainingRecommendation,
    trainingRecommendationLabel: trainingRecommendationLabel(trainingRecommendation),
    rationale,
    voiceRecoveryLine,
    voiceTrainTodayLine,
    muscleRecovery,
    suggestedMuscleGroups,
    avoidMuscleGroups,
    factors,
    transparency,
    trend,
  };
}

export function countConsecutiveTrainingDays(sessionDates: string[]): number {
  if (sessionDates.length === 0) return 0;

  const uniqueDays = [...new Set(sessionDates.map((d) => d.slice(0, 10)))].sort().reverse();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  let startOffset = uniqueDays[0] === todayStr ? 0 : 0;
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
