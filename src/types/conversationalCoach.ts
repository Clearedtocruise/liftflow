export type CoachTopic =
  | 'train_today'
  | 'stalled'
  | 'lift_weight'
  | 'eat'
  | 'fatigued'
  | 'protein'
  | 'general';

export type CoachReferenceSource =
  | 'workout_history'
  | 'recovery'
  | 'nutrition'
  | 'goals'
  | 'progress_photos'
  | 'success_scores';

export type CoachMemoryTurn = {
  id: string;
  message: string;
  topic: CoachTopic;
  shortAnswer: string;
  createdAt: string;
};

export type CoachMemoryState = {
  recentTurns: CoachMemoryTurn[];
  topicCounts: Record<string, number>;
  lastTopic?: CoachTopic;
  summary: string;
};

export type ConversationalCoachContextSnapshot = {
  goals: { primary: string; ranked: string[] };
  workoutHistory: {
    sessionsLast7d: number;
    totalVolume7d: number;
    lastExercise?: string;
    lastWeight?: number;
    lastReps?: number;
  };
  recovery: {
    score: number;
    status: string;
    trainingRecommendation: string;
    suggestedMuscles: string[];
  };
  nutrition: {
    caloriesTarget: number;
    proteinTargetG: number;
    proteinTodayG: number;
    topCoachingTip?: string;
  };
  workoutToday?: {
    sessionLabel?: string;
    isRestDay: boolean;
    targetMuscles: string[];
  };
  outcome: {
    successScore?: number;
    scoreCategory?: string;
    lifeImproved?: boolean;
    riskFlagCount: number;
    activeGoalCount: number;
  };
  progressPhotos: {
    totalCount: number;
    latestDate?: string;
    latestAngle?: string;
  };
  memory: CoachMemoryState;
};

export type ConversationalCoachResponse = {
  id?: string;
  assessedAt: string;
  topic: CoachTopic;
  shortAnswer: string;
  detailedAnswer: string;
  voiceLine: string;
  answer: string;
  referencesUsed: CoachReferenceSource[];
  suggestedFollowUps: string[];
  rationale: string;
  memorySummary: string;
  contextSnapshot: ConversationalCoachContextSnapshot;
};

export type ConversationalCoachRequest = {
  context?: 'workout' | 'recovery' | 'nutrition' | 'general';
  message: string;
  sessionId?: string;
  includeHistory?: boolean;
  detailLevel?: 'short' | 'detailed' | 'voice';
};

export const COACH_STARTER_QUESTIONS: Array<{ topic: CoachTopic; label: string }> = [
  { topic: 'train_today', label: 'What should I train today?' },
  { topic: 'stalled', label: 'Why am I stalled?' },
  { topic: 'lift_weight', label: 'How much should I lift?' },
  { topic: 'eat', label: 'What should I eat?' },
  { topic: 'fatigued', label: 'Why am I fatigued?' },
  { topic: 'protein', label: 'How much protein should I consume?' },
];
