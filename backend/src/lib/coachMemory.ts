import { requireAdmin } from './supabase.js';

export type CoachTopic =
  | 'train_today'
  | 'stalled'
  | 'lift_weight'
  | 'eat'
  | 'fatigued'
  | 'protein'
  | 'general';

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

export function classifyCoachTopic(message: string): CoachTopic {
  const q = message.toLowerCase().trim();

  if (/what\s+should\s+i\s+train|train\s+today|work\s*out\s+today/.test(q)) return 'train_today';
  if (/stalled|plateau|not\s+progress|stuck/.test(q)) return 'stalled';
  if (/how\s+much\s+should\s+i\s+lift|what\s+weight|how\s+much\s+weight/.test(q)) return 'lift_weight';
  if (/what\s+should\s+i\s+eat|what\s+do\s+i\s+eat|meal|nutrition/.test(q) && !/protein/.test(q)) return 'eat';
  if (/fatigue|fatigued|tired|exhausted|why\s+am\s+i\s+so\s+tired/.test(q)) return 'fatigued';
  if (/how\s+much\s+protein|protein\s+should|protein\s+target/.test(q)) return 'protein';

  return 'general';
}

export function buildMemorySummary(turns: CoachMemoryTurn[]): string {
  if (turns.length === 0) return 'No prior coach conversations in this session window.';
  const topics = [...new Set(turns.map((t) => t.topic))];
  const last = turns[0];
  return `Recent topics: ${topics.join(', ')}. Last question was about ${last.topic.replace(/_/g, ' ')}.`;
}

export async function loadCoachMemory(userId: string, limit = 8): Promise<CoachMemoryState> {
  const db = requireAdmin();
  const { data } = await db
    .from('ai_coaching_sessions')
    .select('id, prompt_context, response, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  const recentTurns: CoachMemoryTurn[] = (data ?? []).map((row) => {
    const ctx = (row.prompt_context ?? {}) as Record<string, unknown>;
    return {
      id: row.id,
      message: String(ctx.message ?? ''),
      topic: (ctx.topic as CoachTopic) ?? classifyCoachTopic(String(ctx.message ?? '')),
      shortAnswer: String(ctx.shortAnswer ?? row.response.slice(0, 160)),
      createdAt: row.created_at,
    };
  });

  const topicCounts: Record<string, number> = {};
  for (const turn of recentTurns) {
    topicCounts[turn.topic] = (topicCounts[turn.topic] ?? 0) + 1;
  }

  return {
    recentTurns,
    topicCounts,
    lastTopic: recentTurns[0]?.topic,
    summary: buildMemorySummary(recentTurns),
  };
}

export async function saveCoachTurn(
  userId: string,
  payload: {
    message: string;
    topic: CoachTopic;
    shortAnswer: string;
    detailedAnswer: string;
    voiceLine: string;
    referencesUsed: string[];
    context: string;
    modelVersion: string;
    tokensUsed?: number;
  },
): Promise<string> {
  const db = requireAdmin();
  const { data, error } = await db
    .from('ai_coaching_sessions')
    .insert({
      user_id: userId,
      session_type: payload.context,
      prompt_context: {
        message: payload.message,
        topic: payload.topic,
        shortAnswer: payload.shortAnswer,
        detailedAnswer: payload.detailedAnswer,
        voiceLine: payload.voiceLine,
        referencesUsed: payload.referencesUsed,
      },
      response: payload.detailedAnswer,
      model_version: payload.modelVersion,
      tokens_used: payload.tokensUsed,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id as string;
}
