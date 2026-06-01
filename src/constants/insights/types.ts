export type InsightCategory =
  | 'training'
  | 'nutrition'
  | 'recovery'
  | 'motivation'
  | 'performance'
  | 'coaching';

export type LiftFlowInsight = {
  id: string;
  category: InsightCategory;
  icon: string;
  headline: string;
  body: string;
};

export const INSIGHT_CATEGORY_LABELS: Record<InsightCategory, string> = {
  training: 'Training',
  nutrition: 'Nutrition',
  recovery: 'Recovery',
  motivation: 'Motivation',
  performance: 'Performance',
  coaching: 'AI Coaching',
};
