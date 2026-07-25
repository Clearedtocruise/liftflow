export type MealStatus = 'planned' | 'completed' | 'modified' | 'skipped';
export type MealOrigin = 'plan' | 'log';

export type MealCleanupRow = {
  id: string;
  scheduled_date: string | null;
  meal_type: string;
  instructions: string | null;
  created_at: string;
  meal_plan_id?: string | null;
  name?: string | null;
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  status?: string | null;
  origin?: string | null;
  consumed_at?: string | null;
  client_key?: string | null;
  macros_provided?: boolean | null;
};

type MealRow = MealCleanupRow;

/** Columns every meal read needs so status/origin are never inferred. */
export const MEAL_COLUMNS =
  'id, user_id, meal_plan_id, meal_type, name, scheduled_date, calories, protein_g, carbs_g, fat_g, instructions, status, origin, consumed_at, client_key, macros_provided, created_at';

const STATUS_RANK: Record<MealStatus, number> = {
  completed: 4,
  modified: 3,
  planned: 2,
  skipped: 1,
};

const STATUSES: MealStatus[] = ['planned', 'completed', 'modified', 'skipped'];

/** Rows written before migration 029 keep their status inside the instructions JSON. */
function legacyStatus(instructions: string | null | undefined): MealStatus | null {
  if (!instructions || !instructions.trimStart().startsWith('{')) return null;
  try {
    const parsed = JSON.parse(instructions) as { status?: unknown };
    return STATUSES.find((candidate) => candidate === parsed.status) ?? null;
  } catch {
    return null;
  }
}

export function mealOrigin(row: MealRow): MealOrigin {
  if (row.origin === 'plan' || row.origin === 'log') return row.origin;
  return row.meal_plan_id ? 'plan' : 'log';
}

export function mealStatus(row: MealRow): MealStatus {
  return (
    STATUSES.find((candidate) => candidate === row.status)
    ?? legacyStatus(row.instructions)
    ?? (mealOrigin(row) === 'log' ? 'completed' : 'planned')
  );
}

/**
 * Identity used for de-duplication. Only rows that provably describe the same
 * record collapse: a shared client key, or a plan slot for the same day and
 * meal type (which repeated plan generation can create twice). User-logged
 * meals without a client key have no identity, so two snacks on the same day
 * are never mistaken for duplicates.
 */
function identityKey(row: MealRow): string | null {
  if (row.client_key) return `key:${row.client_key}`;
  if (mealOrigin(row) !== 'plan' || !row.scheduled_date) return null;
  return `plan:${row.scheduled_date}:${row.meal_type}`;
}

/** Pick one keeper per meal identity; prefer completed/modified, then newest. */
export function pickMealsToKeep(meals: MealRow[]): { keep: MealRow[]; removeIds: string[] } {
  const groups = new Map<string, MealRow[]>();
  const keep: MealRow[] = [];
  const removeIds: string[] = [];

  for (const meal of meals) {
    const key = identityKey(meal);
    if (!key) {
      keep.push(meal);
      continue;
    }
    const bucket = groups.get(key) ?? [];
    bucket.push(meal);
    groups.set(key, bucket);
  }

  for (const group of groups.values()) {
    if (group.length === 1) {
      keep.push(group[0]);
      continue;
    }

    const sorted = [...group].sort((a, b) => {
      const rankDiff = STATUS_RANK[mealStatus(b)] - STATUS_RANK[mealStatus(a)];
      if (rankDiff !== 0) return rankDiff;
      return b.created_at.localeCompare(a.created_at);
    });

    keep.push(sorted[0]);
    for (let index = 1; index < sorted.length; index += 1) {
      removeIds.push(sorted[index].id);
    }
  }

  return { keep, removeIds };
}

/** Untouched plan slots may be replaced by a regenerated plan; logs may not. */
export function isReplaceablePlannedMeal(row: MealRow): boolean {
  if (mealOrigin(row) !== 'plan') return false;
  const status = mealStatus(row);
  return status === 'planned' || status === 'skipped';
}

export function weekEndDate(weekStart: string): string {
  const end = new Date(`${weekStart}T12:00:00`);
  end.setDate(end.getDate() + 6);
  return end.toISOString().slice(0, 10);
}

export async function removePlannedMealsForWeek(
  db: { from: (table: string) => any },
  userId: string,
  weekStart: string,
  weekEnd: string,
): Promise<number> {
  const { data } = await db
    .from('meals')
    .select(MEAL_COLUMNS)
    .eq('user_id', userId)
    .gte('scheduled_date', weekStart)
    .lte('scheduled_date', weekEnd);

  const removeIds = ((data ?? []) as MealRow[]).filter(isReplaceablePlannedMeal).map((row) => row.id);

  if (removeIds.length === 0) return 0;

  const { error } = await db.from('meals').delete().in('id', removeIds);
  if (error) throw new Error(error.message);
  return removeIds.length;
}

export async function pruneDuplicateMeals(
  db: { from: (table: string) => any },
  userId: string,
  range?: { from?: string; to?: string },
): Promise<number> {
  let query = db.from('meals').select(MEAL_COLUMNS).eq('user_id', userId);
  if (range?.from) query = query.gte('scheduled_date', range.from);
  if (range?.to) query = query.lte('scheduled_date', range.to);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as MealRow[];
  const { removeIds } = pickMealsToKeep(rows);

  if (removeIds.length === 0) return 0;

  const { error: deleteError } = await db.from('meals').delete().in('id', removeIds);
  if (deleteError) throw new Error(deleteError.message);
  return removeIds.length;
}
