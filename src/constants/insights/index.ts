import type { InsightCategory } from './types';
import { ALL_INSIGHTS } from './library';

export { ALL_INSIGHTS } from './library';
export type { InsightCategory, LiftFlowInsight } from './types';
export { INSIGHT_CATEGORY_LABELS } from './types';

export function getInsightById(id: string) {
  return ALL_INSIGHTS.find((insight) => insight.id === id) ?? null;
}

export function getInsightsByCategory(category: InsightCategory) {
  return ALL_INSIGHTS.filter((insight) => insight.category === category);
}
