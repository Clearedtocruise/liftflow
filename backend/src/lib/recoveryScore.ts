export type DailyRecoveryInput = {
  sleepHours?: number;
  sleepQuality?: number;
  energyLevel?: number;
  stressLevel?: number;
  sorenessLevel?: number;
};

export type RecoveryResult = {
  recoveryScore: number;
  status: 'optimal' | 'moderate' | 'fatigued' | 'overreached' | 'unknown';
  dailyRecommendation: string;
  recoveryModeActive: boolean;
  volumeMultiplier: number;
  intensityMultiplier: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function scoreSleepHours(hours?: number): number {
  if (hours == null) return 70;
  if (hours >= 7 && hours <= 9) return 100;
  if (hours >= 6 && hours < 7) return 75;
  if (hours > 9 && hours <= 10) return 85;
  if (hours >= 5) return 55;
  return 35;
}

function scoreScale(value: number | undefined, invert = false): number {
  if (value == null) return 70;
  const normalized = clamp(value, 1, 10);
  const score = invert ? (11 - normalized) * 10 : normalized * 10;
  return clamp(score, 0, 100);
}

export function calculateRecoveryScore(input: DailyRecoveryInput): RecoveryResult {
  const sleepHoursScore = scoreSleepHours(input.sleepHours);
  const sleepQualityScore = scoreScale(input.sleepQuality);
  const energyScore = scoreScale(input.energyLevel);
  const stressScore = scoreScale(input.stressLevel, true);
  const sorenessScore = scoreScale(input.sorenessLevel, true);

  const recoveryScore = Math.round(
    sleepHoursScore * 0.25 +
      sleepQualityScore * 0.2 +
      energyScore * 0.25 +
      stressScore * 0.15 +
      sorenessScore * 0.15,
  );

  let status: RecoveryResult['status'] = 'optimal';
  let dailyRecommendation = 'Proceed as planned';
  let recoveryModeActive = false;
  let volumeMultiplier = 1;
  let intensityMultiplier = 1;

  if (recoveryScore >= 85) {
    status = 'optimal';
    dailyRecommendation = 'Recovery Score high — proceed as planned.';
  } else if (recoveryScore >= 60) {
    status = 'moderate';
    volumeMultiplier = 0.9;
    intensityMultiplier = 0.95;
    dailyRecommendation = 'Reduce volume 10% and prioritize quality reps.';
  } else if (recoveryScore >= 40) {
    status = 'fatigued';
    volumeMultiplier = 0.8;
    intensityMultiplier = 0.85;
    dailyRecommendation = 'Reduce volume 20% — focus on technique and mobility.';
  } else {
    status = 'overreached';
    recoveryModeActive = true;
    volumeMultiplier = 0.5;
    intensityMultiplier = 0.7;
    dailyRecommendation = 'Recovery Mode Active — light movement, mobility, and rest recommended.';
  }

  return {
    recoveryScore,
    status,
    dailyRecommendation,
    recoveryModeActive,
    volumeMultiplier,
    intensityMultiplier,
  };
}

export function mergeTrainingLoadScore(
  subjectiveScore: number,
  sessionCount3d: number,
  totalVolume3d: number,
): number {
  let adjusted = subjectiveScore;
  if (sessionCount3d >= 4 || totalVolume3d > 50000) adjusted -= 15;
  else if (sessionCount3d >= 3) adjusted -= 8;
  return clamp(Math.round(adjusted), 0, 100);
}
