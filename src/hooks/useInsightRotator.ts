import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  ALL_INSIGHTS,
  getInsightById,
  getInsightsByCategory,
} from '@/constants/insights';
import type { InsightCategory, LiftFlowInsight } from '@/constants/insights/types';

const STORAGE_KEY = 'liftflow_insight_queue';

type QueueState = {
  queue: string[];
  index: number;
  lastId: string | null;
  category: InsightCategory | null;
};

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function buildShuffledQueue(category: InsightCategory | undefined, avoidId: string | null): string[] {
  const pool = category ? getInsightsByCategory(category) : ALL_INSIGHTS;
  if (pool.length === 0) return [];

  let ids = shuffle(pool.map((insight) => insight.id));

  if (avoidId && ids.length > 1 && ids[0] === avoidId) {
    const swapIndex = 1 + Math.floor(Math.random() * (ids.length - 1));
    [ids[0], ids[swapIndex]] = [ids[swapIndex], ids[0]];
  }

  return ids;
}

function parseQueueState(raw: string | null): QueueState | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<QueueState>;
    if (!Array.isArray(parsed.queue) || typeof parsed.index !== 'number') {
      return null;
    }

    return {
      queue: parsed.queue.filter((id): id is string => typeof id === 'string'),
      index: parsed.index,
      lastId: typeof parsed.lastId === 'string' ? parsed.lastId : null,
      category: parsed.category ?? null,
    };
  } catch {
    return null;
  }
}

async function loadQueueState(): Promise<QueueState | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return parseQueueState(raw);
}

async function saveQueueState(state: QueueState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function resolveNextInsight(
  state: QueueState,
  category: InsightCategory | undefined,
): { insight: LiftFlowInsight | null; nextState: QueueState } {
  const filterCategory = category ?? null;
  const needsRebuild =
    state.queue.length === 0 ||
    state.category !== filterCategory ||
    state.index >= state.queue.length;

  let queue = state.queue;
  let index = state.index;
  let lastId = state.lastId;

  if (needsRebuild) {
    queue = buildShuffledQueue(category, lastId);
    index = 0;
  }

  if (queue.length === 0) {
    return {
      insight: null,
      nextState: { queue: [], index: 0, lastId, category: filterCategory },
    };
  }

  let nextId = queue[index];

  if (nextId === lastId && queue.length > 1) {
    index += 1;
    if (index >= queue.length) {
      queue = buildShuffledQueue(category, lastId);
      index = 0;
    }
    nextId = queue[index];
  }

  const insight = getInsightById(nextId);
  lastId = nextId;
  index += 1;

  if (index >= queue.length) {
    queue = buildShuffledQueue(category, lastId);
    index = 0;
  }

  return {
    insight,
    nextState: {
      queue,
      index,
      lastId,
      category: filterCategory,
    },
  };
}

export function useInsightRotator(category?: InsightCategory) {
  const [insight, setInsight] = useState<LiftFlowInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const categoryRef = useRef(category);

  categoryRef.current = category;

  const nextInsight = useCallback(async () => {
    setLoading(true);

    try {
      const currentCategory = categoryRef.current;
      const stored = await loadQueueState();
      const initialState: QueueState = stored ?? {
        queue: [],
        index: 0,
        lastId: null,
        category: null,
      };

      const { insight: next, nextState } = resolveNextInsight(initialState, currentCategory);
      await saveQueueState(nextState);
      setInsight(next);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    nextInsight();
  }, [category, nextInsight]);

  return {
    insight,
    loading,
    nextInsight,
  };
}
