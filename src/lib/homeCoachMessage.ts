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

/** Trim planner rationale for Home “Why today” — null when empty. */
export function formatWhyTodayRationale(rationale?: string | null, maxLength = 160): string | null {
  if (!rationale) return null;
  const cleaned = rationale.replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

/** Prefer a short joint-friendly / age line when present in planner rationale. */
export function formatWhyTodayWithAgeEmphasis(rationale?: string | null, maxLength = 160): string | null {
  if (!rationale) return null;
  const cleaned = rationale.replace(/\s+/g, ' ').trim();
  const jointMatch = cleaned.match(/Joint-friendly selections prioritized[^.]*(?:\.|$)/i);
  const ageMatch = cleaned.match(/age-aware intensity[^.]*(?:\.|$)/i);
  const highlight = (jointMatch?.[0] ?? ageMatch?.[0] ?? '').trim();
  if (highlight) {
    const lead = highlight.endsWith('.') ? highlight : `${highlight}.`;
    if (lead.length >= maxLength) return formatWhyTodayRationale(lead, maxLength);
    const rest = cleaned.replace(highlight, '').replace(/\s+/g, ' ').trim();
    if (!rest) return lead;
    return formatWhyTodayRationale(`${lead} ${rest}`, maxLength);
  }
  return formatWhyTodayRationale(cleaned, maxLength);
}
