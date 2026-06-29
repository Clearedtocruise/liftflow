import type { CoachTrainingGuidance } from '@/lib/activeTrainingDay';
import type { RecoveryIntelligenceReport } from '@/types/recoveryIntelligence';
import type { PlannedWorkout } from '@/types/training';

function recoveryStatusLine(recoveryIntel: RecoveryIntelligenceReport | null, recoveryScore: number | null): string {
  if (recoveryIntel?.recoveryStatusLabel) return recoveryIntel.recoveryStatusLabel;
  if (recoveryScore == null) return 'Check in for recovery guidance';
  if (recoveryScore >= 80) return 'Fully recovered';
  if (recoveryScore >= 60) return 'Ready to train';
  if (recoveryScore >= 40) return 'Train light';
  return 'Recovery needed';
}

/** Home coach copy must match today's scheduled workout — not generic muscle readiness. */
export function formatHomeCoachMessage(
  guidance: CoachTrainingGuidance,
  options: {
    scheduledWorkout: PlannedWorkout | null;
    recoveryIntel: RecoveryIntelligenceReport | null;
    recoveryScore: number | null;
  },
): string {
  const { scheduledWorkout, recoveryIntel, recoveryScore } = options;
  const status = recoveryStatusLine(recoveryIntel, recoveryScore);

  if (scheduledWorkout) {
    if (guidance.trainingRecommendation === 'train_light') {
      return `Lighter volume today for ${scheduledWorkout.name}. Status: ${status}.`;
    }
    if (guidance.trainingRecommendation === 'recovery_session') {
      return `Easy session: ${scheduledWorkout.name}. Focus mobility and technique. Status: ${status}.`;
    }
    return `Ready for ${scheduledWorkout.name}. Status: ${status}.`;
  }

  if (guidance.trainingRecommendation === 'rest_day') {
    return guidance.coachMessage || `Rest day recommended. Status: ${status}.`;
  }

  return guidance.coachMessage || `Complete today's recovery check-in for personalized guidance.`;
}
