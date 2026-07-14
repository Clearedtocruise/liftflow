import type {
    AIRecommendationType,
    BaseEntity,
    ResearchCitation
} from './common';
import type { ParsedVoiceCommandExtended } from './voice';

export type AICoachingSession = BaseEntity & {
  userId: string;
  sessionType: string;
  promptContext: Record<string, unknown>;
  response: string;
  citations: ResearchCitation[];
  modelVersion?: string;
  tokensUsed?: number;
};

export type AIRecommendation = BaseEntity & {
  userId: string;
  recommendationType: AIRecommendationType;
  title: string;
  description: string;
  rationale?: string;
  evidenceCitations: ResearchCitation[];
  payload: Record<string, unknown>;
  confidence?: number;
  isAccepted?: boolean;
  expiresAt?: string;
};

export type AIInsight = BaseEntity & {
  userId: string;
  insightType: string;
  title: string;
  body: string;
  educationalContent?: string;
  researchCitations: ResearchCitation[];
  relatedSessionIds: string[];
  isRead: boolean;
};

export type CoachingRequest = {
  context: 'workout' | 'recovery' | 'nutrition' | 'general';
  message?: string;
  sessionId?: string;
  includeHistory?: boolean;
};

export type ProgressionSuggestion = {
  exerciseId: string;
  exerciseName: string;
  lastWeight: number;
  lastReps: number;
  suggestedWeight: number;
  suggestedRepRange: string;
  rationale: string;
  confidence: number;
  evidenceCitations?: ResearchCitation[];
};

export type ParseVoiceRequest = {
  transcript: string;
  sessionId?: string;
  activeExerciseId?: string;
  context?: Record<string, unknown>;
};

export type ParseVoiceResponse = {
  parsed: ParsedVoiceCommandExtended;
  confidence: number;
  requiresConfirmation: boolean;
  confirmationReason?: string;
};
