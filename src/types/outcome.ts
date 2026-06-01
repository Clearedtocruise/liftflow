/** Sprint 6.0 — Outcome intelligence types (client + API contracts) */

export type ScoreCategory = 'exceptional' | 'good' | 'needs_attention' | 'at_risk';

export type UserOutcomeBaseline = {
  id: string;
  user_id: string;
  starting_weight_kg: number | null;
  starting_body_fat_pct: number | null;
  starting_measurements: Record<string, number>;
  starting_strength_metrics: Record<string, number>;
  starting_recovery_score: number | null;
  onboarding_date: string;
};

export type UserOutcomeSnapshot = {
  id: string;
  user_id: string;
  snapshot_date: string;
  period_type: 'daily' | 'weekly';
  current_weight_kg: number | null;
  current_body_fat_pct: number | null;
  weight_delta_kg: number | null;
  body_fat_delta_pct: number | null;
  strength_delta: Record<string, number>;
  recovery_delta: number | null;
  workout_adherence_pct: number | null;
  nutrition_adherence_pct: number | null;
};

export type UserSuccessScore = {
  id: string;
  user_id: string;
  computed_at: string;
  overall_score: number;
  workout_adherence_score: number | null;
  nutrition_adherence_score: number | null;
  recovery_compliance_score: number | null;
  goal_progress_score: number | null;
  strength_progress_score: number | null;
  weight_progress_score: number | null;
  score_category: ScoreCategory;
  life_improved: boolean;
};

export type UserRiskFlag = {
  id: string;
  user_id: string;
  risk_level: 'low' | 'moderate' | 'at_risk' | 'critical';
  risk_reason: string;
  generated_coaching_message: string | null;
  is_active: boolean;
  created_at: string;
};

export type GoalWithAchievement = {
  completion_pct?: number | null;
  projected_completion_date?: string | null;
  velocity?: number | null;
  baseline_value?: number | null;
};

export type UserOutcomeSummary = {
  baseline: UserOutcomeBaseline | null;
  latestSnapshot: UserOutcomeSnapshot | null;
  successScore: UserSuccessScore | null;
  activeRiskFlags: UserRiskFlag[];
  activeGoals: GoalWithAchievement[];
};
