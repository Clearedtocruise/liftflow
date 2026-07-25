import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Meal, NutritionGoals, PlannedWorkout, ProgramDashboard } from '@/types';

type CacheEnvelope<T> = {
  savedAt: string;
  data: T;
};

const memory = new Map<string, string>();

function cacheKey(userId: string, weekFrom: string, weekTo: string, kind: string): string {
  return `@liftflow/plan/${kind}/${userId}/${weekFrom}/${weekTo}`;
}

function goalsKey(userId: string): string {
  return `@liftflow/plan/goals/${userId}`;
}

async function readJson<T>(key: string): Promise<T | null> {
  const mem = memory.get(key);
  const raw = mem ?? (await AsyncStorage.getItem(key));
  if (!raw) return null;
  if (!mem) memory.set(key, raw);
  try {
    const envelope = JSON.parse(raw) as CacheEnvelope<T>;
    return envelope.data ?? null;
  } catch {
    return null;
  }
}

async function writeJson<T>(key: string, data: T): Promise<void> {
  const payload = JSON.stringify({ savedAt: new Date().toISOString(), data } satisfies CacheEnvelope<T>);
  memory.set(key, payload);
  await AsyncStorage.setItem(key, payload);
}

export type WeekPlanCacheSnapshot = {
  workouts: PlannedWorkout[];
  meals: Meal[];
  goals: NutritionGoals | null;
  program: ProgramDashboard | null;
};

export const planDataCache = {
  async readWeek(
    userId: string,
    weekFrom: string,
    weekTo: string,
  ): Promise<WeekPlanCacheSnapshot> {
    const [workouts, meals, goals, program] = await Promise.all([
      readJson<PlannedWorkout[]>(cacheKey(userId, weekFrom, weekTo, 'workouts')),
      readJson<Meal[]>(cacheKey(userId, weekFrom, weekTo, 'meals')),
      readJson<NutritionGoals>(goalsKey(userId)),
      readJson<ProgramDashboard | null>(cacheKey(userId, weekFrom, weekTo, 'program')),
    ]);

    return {
      workouts: workouts ?? [],
      meals: meals ?? [],
      goals: goals ?? null,
      program: program ?? null,
    };
  },

  async writeWorkouts(
    userId: string,
    weekFrom: string,
    weekTo: string,
    workouts: PlannedWorkout[],
  ): Promise<void> {
    await writeJson(cacheKey(userId, weekFrom, weekTo, 'workouts'), workouts);
  },

  async writeMeals(userId: string, weekFrom: string, weekTo: string, meals: Meal[]): Promise<void> {
    await writeJson(cacheKey(userId, weekFrom, weekTo, 'meals'), meals);
  },

  /** Merge updated meals into the cached week by id and return the full merged list. */
  async patchMeals(
    userId: string,
    weekFrom: string,
    weekTo: string,
    updated: Meal[],
  ): Promise<Meal[]> {
    const cached = await readJson<Meal[]>(cacheKey(userId, weekFrom, weekTo, 'meals'));
    const byId = new Map((cached ?? []).map((meal) => [meal.id, meal]));
    for (const meal of updated) byId.set(meal.id, meal);
    const merged = [...byId.values()];
    await writeJson(cacheKey(userId, weekFrom, weekTo, 'meals'), merged);
    return merged;
  },

  async writeGoals(userId: string, goals: NutritionGoals | null): Promise<void> {
    if (!goals) return;
    await writeJson(goalsKey(userId), goals);
  },

  async writeProgram(
    userId: string,
    weekFrom: string,
    weekTo: string,
    program: ProgramDashboard | null,
  ): Promise<void> {
    await writeJson(cacheKey(userId, weekFrom, weekTo, 'program'), program);
  },

  /** Warm AsyncStorage → memory for the current week (call as early as auth allows). */
  prefetchWeek(userId: string, weekFrom: string, weekTo: string): void {
    void this.readWeek(userId, weekFrom, weekTo);
  },

  async clearUser(userId: string): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const userKeys = keys.filter((key) => key.includes(`/${userId}/`) || key.endsWith(`/${userId}`));
    await AsyncStorage.multiRemove(userKeys);
    for (const key of [...memory.keys()]) {
      if (key.includes(`/${userId}/`) || key.endsWith(`/${userId}`)) memory.delete(key);
    }
  },
};
