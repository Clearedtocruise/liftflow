import { api } from '@/api/client';
import { API_BASE_URL } from '@/constants/api';
import { fail, fromError, ok } from '@/lib/serviceResult';
import type { IAICoachingService } from '@/services/interfaces';
import { getAccessToken, supabase } from '@/supabase/client';
import type { AIRecommendation, CoachingRequest } from '@/types';

export const aiService: IAICoachingService = {
  async getRecommendations(userId) {
    try {
      const token = await getAccessToken();
      const remote = await api.getRecommendations(userId, token).catch(() => null);

      if (remote && remote.length > 0) {
        for (const rec of remote) {
          await supabase.from('ai_recommendations').upsert(
            {
              user_id: userId,
              recommendation_type: rec.recommendationType,
              title: rec.title,
              description: rec.description,
              rationale: rec.rationale,
              evidence_citations: rec.evidenceCitations,
              payload: rec.payload,
              confidence: rec.confidence,
            },
            { onConflict: 'id', ignoreDuplicates: true },
          );
        }
      }

      const { data, error } = await supabase
        .from('ai_recommendations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) return fail(error.message);

      return ok(
        (data ?? []).map(
          (row) =>
            ({
              id: row.id,
              userId: row.user_id,
              recommendationType: row.recommendation_type,
              title: row.title,
              description: row.description,
              rationale: row.rationale ?? undefined,
              evidenceCitations: row.evidence_citations ?? [],
              payload: row.payload ?? {},
              confidence: row.confidence ?? undefined,
              isAccepted: row.is_accepted ?? undefined,
              expiresAt: row.expires_at ?? undefined,
              createdAt: row.created_at,
            }) satisfies AIRecommendation,
        ),
      );
    } catch (e) {
      return fromError(e);
    }
  },

  async acceptRecommendation(id) {
    try {
      const { data, error } = await supabase
        .from('ai_recommendations')
        .update({ is_accepted: true })
        .eq('id', id)
        .select('*')
        .single();

      if (error) return fail(error.message);

      return ok({
        id: data.id,
        userId: data.user_id,
        recommendationType: data.recommendation_type,
        title: data.title,
        description: data.description,
        rationale: data.rationale ?? undefined,
        evidenceCitations: data.evidence_citations ?? [],
        payload: data.payload ?? {},
        confidence: data.confidence ?? undefined,
        isAccepted: true,
        createdAt: data.created_at,
      });
    } catch (e) {
      return fromError(e);
    }
  },

  async dismissRecommendation(id) {
    try {
      const { error } = await supabase.from('ai_recommendations').delete().eq('id', id);
      if (error) return fail(error.message);
      return ok(undefined);
    } catch (e) {
      return fromError(e);
    }
  },

  async getInsights(userId) {
    try {
      const { data, error } = await supabase
        .from('ai_insights')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) return fail(error.message);

      return ok(
        (data ?? []).map((row) => ({
          id: row.id,
          userId: row.user_id,
          insightType: row.insight_type,
          title: row.title,
          body: row.body,
          educationalContent: row.educational_content ?? undefined,
          researchCitations: row.research_citations ?? [],
          relatedSessionIds: row.related_session_ids ?? [],
          isRead: row.is_read ?? false,
          createdAt: row.created_at,
        })),
      );
    } catch (e) {
      return fromError(e);
    }
  },

  async markInsightRead(id) {
    try {
      const { error } = await supabase.from('ai_insights').update({ is_read: true }).eq('id', id);
      if (error) return fail(error.message);
      return ok(undefined);
    } catch (e) {
      return fromError(e);
    }
  },

  async askCoach(userId, request: CoachingRequest) {
    try {
      const token = await getAccessToken();
      const response = await api.askCoach({ ...request, userId, message: request.message ?? '' }, token);

      const { data, error } = await supabase
        .from('ai_coaching_sessions')
        .insert({
          user_id: userId,
          session_type: request.context,
          prompt_context: { message: request.message, sessionId: request.sessionId },
          response: response.response,
          citations: response.citations ?? [],
          model_version: response.modelVersion,
          tokens_used: response.tokensUsed,
        })
        .select('*')
        .single();

      if (error) return fail(error.message);

      return ok({
        id: data.id,
        userId: data.user_id,
        sessionType: data.session_type,
        promptContext: data.prompt_context,
        response: data.response,
        citations: data.citations ?? [],
        modelVersion: data.model_version ?? undefined,
        tokensUsed: data.tokens_used ?? undefined,
        createdAt: data.created_at,
      });
    } catch (e) {
      return fromError(e);
    }
  },

  async suggestProgression(userId, exerciseId) {
    try {
      const token = await getAccessToken();
      const suggestion = await api.suggestProgression(exerciseId, token);
      return ok(suggestion);
    } catch (e) {
      return fromError(e);
    }
  },

  async suggestWorkout(userId) {
    try {
      const token = await getAccessToken();
      const muscles = await api.suggestMuscleGroups(userId, token);
      const name = `${muscles.primaryGroups.join(' & ')} Day`;

      const { data, error } = await supabase
        .from('planned_workouts')
        .insert({
          user_id: userId,
          name,
          scheduled_date: new Date().toISOString().slice(0, 10),
          status: 'planned',
          suggested_muscle_groups: muscles.primaryGroups,
          ai_rationale: muscles.rationale,
        })
        .select('*')
        .single();

      if (error) return fail(error.message);

      return ok({
        id: data.id,
        userId: data.user_id,
        name: data.name,
        scheduledDate: data.scheduled_date,
        scheduledTime: data.scheduled_time ?? undefined,
        status: data.status,
        suggestedMuscleGroups: data.suggested_muscle_groups ?? [],
        aiRationale: data.ai_rationale ?? undefined,
        createdAt: data.created_at,
      });
    } catch (e) {
      return fromError(e);
    }
  },

  async refreshCoaching(userId: string) {
    try {
      const token = await getAccessToken();
      const response = await fetch(`${API_BASE_URL}/api/ai/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: response.statusText }));
        return fail(err.message ?? 'Failed to refresh coaching');
      }

      return this.getRecommendations(userId);
    } catch (e) {
      return fromError(e);
    }
  },
};