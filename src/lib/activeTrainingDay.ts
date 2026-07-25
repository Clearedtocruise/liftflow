import { localDateString } from '@/lib/localDate';
import { trainingLabelFromRecoveryScore } from '@/lib/mealAggregation';
import {
  dedupePlannedWorkoutsByDate,
  isScheduledWorkoutStatus,
  isStartableWorkoutStatus,
} from '@/lib/weekPlan';
import type { RecoveryIntelligenceReport, TrainingDayRecommendation } from '@/types/recoveryIntelligence';
import type { PlannedWorkout } from '@/types/training';

/** Authoritative assignment for a calendar training day. */
export type ActiveTrainingDay = {
  date: string;
  workout: PlannedWorkout | null;
  scheduledWorkout: PlannedWorkout | null;
  workoutId: string | null;
  workoutName: string | null;
  /** True only when no planned workout is scheduled for this date. */
  isScheduledRestDay: boolean;
  /** True only when a planned workout can be started from this assignment. */
  isStartableWorkoutDay: boolean;
};

export type CoachTrainingGuidance = {
  trainingRecommendation: TrainingDayRecommendation;
  trainingLabel: string;
  coachHeadline: string;
  coachMessage: string;
  volumeMultiplier: number;
};

const TRAINING_LABELS: Record<TrainingDayRecommendation, string> = {
  train: 'Train',
  train_light: 'Train Light',
  recovery_session: 'Recovery Session',
  rest_day: 'Rest Day',
};

function scoreToRecommendation(score: number): TrainingDayRecommendation {
  if (score >= 75) return 'train';
  if (score >= 55) return 'train_light';
  if (score >= 40) return 'recovery_session';
  return 'rest_day';
}

/** Scheduled workout wins — recovery may lower intensity but never cancels a planned session. */
export function coerceTrainingRecommendationForSchedule(
  recommendation: TrainingDayRecommendation,
  hasScheduledWorkout: boolean,
): TrainingDayRecommendation {
  if (!hasScheduledWorkout) return recommendation;
  if (recommendation === 'rest_day' || recommendation === 'recovery_session') return 'train_light';
  return recommendation;
}

export function resolveActiveTrainingDay(
  workouts: PlannedWorkout[],
  options?: { date?: string; timeZone?: string | null; reference?: Date },
): ActiveTrainingDay {
  const reference = options?.reference ?? new Date();
  const date = options?.date ?? localDateString(reference, options?.timeZone);
  const deduped = dedupePlannedWorkoutsByDate(workouts, reference, options?.timeZone);
  const scheduledWorkout = deduped.find((w) => w.scheduledDate === date && isScheduledWorkoutStatus(w.status)) ?? null;
  const workout = scheduledWorkout && isStartableWorkoutStatus(scheduledWorkout.status) ? scheduledWorkout : null;

  return {
    date,
    workout,
    scheduledWorkout,
    workoutId: scheduledWorkout?.id ?? null,
    workoutName: scheduledWorkout?.name ?? null,
    isScheduledRestDay: scheduledWorkout == null,
    isStartableWorkoutDay: workout != null,
  };
}

export function resolveCoachTrainingGuidance(
  recoveryIntel: RecoveryIntelligenceReport | null,
  recoveryScore: number | null,
  activeDay: ActiveTrainingDay,
): CoachTrainingGuidance {
  const rawRecommendation: TrainingDayRecommendation =
    recoveryIntel?.trainingRecommendation ??
    (recoveryScore != null ? scoreToRecommendation(recoveryScore) : 'train');

  const trainingRecommendation = coerceTrainingRecommendationForSchedule(
    rawRecommendation,
    !activeDay.isScheduledRestDay,
  );

  const trainingLabel =
    recoveryIntel?.trainingRecommendationLabel && trainingRecommendation === rawRecommendation
      ? recoveryIntel.trainingRecommendationLabel
      : TRAINING_LABELS[trainingRecommendation];

  let volumeMultiplier = 1;
  if (trainingRecommendation === 'train_light') volumeMultiplier = 0.75;
  else if (trainingRecommendation === 'recovery_session') volumeMultiplier = 0.5;

  const coachHeadline = activeDay.scheduledWorkout
    ? `${trainingLabel} · ${activeDay.workoutName ?? 'Scheduled workout'}`
    : activeDay.isScheduledRestDay
      ? `${trainingLabel} · Rest day`
      : `${trainingLabel} recommended today`;

  let coachMessage = recoveryIntel?.rationale ?? '';
  if (trainingRecommendation === 'train_light' && activeDay.scheduledWorkout) {
    if (!coachMessage.includes('light') && !coachMessage.includes('volume')) {
      coachMessage =
        'Recovery suggests training light today — keep the scheduled workout but reduce volume 20–30% and avoid failure sets.';
    }
  } else if (!coachMessage && recoveryScore != null) {
    coachMessage =
      recoveryScore >= 80
        ? 'Recovery is strong. Match nutrition to your remaining macros.'
        : 'Prioritize quality over volume. Match nutrition to your remaining macros.';
  } else if (!coachMessage) {
    coachMessage = 'Complete today\'s recovery check-in for personalized guidance.';
  }

  return {
    trainingRecommendation,
    trainingLabel,
    coachHeadline,
    coachMessage,
    volumeMultiplier,
  };
}

/** Fallback label when intelligence report is unavailable. */
export function trainingLabelForScore(score: number | null): string {
  if (score == null) return 'Check in';
  return trainingLabelFromRecoveryScore(score);
}

export function workoutAssignmentKey(active: ActiveTrainingDay): string {
  return `${active.date}:${active.workoutId ?? 'rest'}`;
}

export function validateWorkoutAssignmentConsistency(
  screens: Record<string, ActiveTrainingDay | null | undefined>,
): string[] {
  const entries = Object.entries(screens).filter(([, value]) => value != null) as Array<
    [string, ActiveTrainingDay]
  >;
  if (entries.length < 2) return [];

  const first = workoutAssignmentKey(entries[0][1]);
  const mismatches = entries.filter(([, value]) => workoutAssignmentKey(value) !== first);
  if (mismatches.length === 0) return [];

  return mismatches.map(
    ([screen, value]) =>
      `${screen}=${value.workoutId ?? 'rest'} (${value.date})`,
  );
}
