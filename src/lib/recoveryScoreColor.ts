import { LiftFlowColors } from '@/constants/theme';

/** Ring color by recovery score (green ≥80, amber 55–79, red <55). */
export function recoveryScoreColor(score: number | null | undefined): string {
  if (score == null) return LiftFlowColors.textTertiary;
  if (score >= 80) return LiftFlowColors.success;
  if (score >= 55) return LiftFlowColors.warning;
  return LiftFlowColors.error;
}
