import { apiClient } from '@/api/client';
import { fail, fromError, ok } from '@/lib/serviceResult';
import { getAccessToken } from '@/supabase/client';
import type {
  ConversationalCoachRequest,
  ConversationalCoachResponse,
} from '@/types/conversationalCoach';
import type { ServiceResult } from '@/types/common';

export type CoachHistoryResponse = {
  turns: Array<{
    id: string;
    message: string;
    topic: string;
    shortAnswer: string;
    createdAt: string;
  }>;
  summary: string;
  suggestedQuestions: string[];
};

export const conversationalCoachService = {
  async ask(
    userId: string,
    request: ConversationalCoachRequest,
  ): Promise<ServiceResult<ConversationalCoachResponse>> {
    try {
      const token = await getAccessToken();
      const report = await apiClient.post<ConversationalCoachResponse>(
        '/api/ai/converse',
        { userId, ...request },
        token,
      );
      return ok(report);
    } catch (e) {
      return fromError(e);
    }
  },

  async getHistory(userId: string, limit = 20): Promise<ServiceResult<CoachHistoryResponse>> {
    try {
      const token = await getAccessToken();
      const history = await apiClient.get<CoachHistoryResponse>(
        `/api/ai/converse/history?userId=${userId}&limit=${limit}`,
        token,
      );
      return ok(history);
    } catch (e) {
      return fromError(e);
    }
  },
};
