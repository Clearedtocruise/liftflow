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
};

type MealRow = MealCleanupRow;

type MealStatus = 'planned' | 'completed' | 'modified' | 'skipped';

const STATUS_RANK: Record<MealStatus, number> = {
  completed: 4,
  modified: 3,
  planned: 2,
  skipped: 1,
};

function parseMealStatus(instructions: string | null | undefined): MealStatus {
  if (!instructions) return 'planned';
  try {
    const parsed = JSON.parse(instructions) as { status?: MealStatus };
    return parsed.status ?? 'planned';
  } catch {
    return 'planned';
  }
}

function slotKey(row: MealRow): string | null {
  if (!row.scheduled_date) return null;
  return `${row.scheduled_date}:${row.meal_type}`;
}

/** Pick one keeper per date+meal_type; prefer completed/modified, then newest. */
export function pickMealsToKeep(meals: MealRow[]): { keep: MealRow[]; removeIds: string[] } {
  const groups = new Map<string, MealRow[]>();

  for (const meal of meals) {
    const key = slotKey(meal);
    if (!key) continue;
    const bucket = groups.get(key) ?? [];
    bucket.push(meal);
    groups.set(key, bucket);
  }

  const keep: MealRow[] = [];
  const removeIds: string[] = [];

  for (const group of groups.values()) {
    if (group.length === 1) {
      keep.push(group[0]);
      continue;
    }

    const sorted = [...group].sort((a, b) => {
      const rankDiff = STATUS_RANK[parseMealStatus(b.instructions)] - STATUS_RANK[parseMealStatus(a.instructions)];
      if (rankDiff !== 0) return rankDiff;
      return b.created_at.localeCompare(a.created_at);
    });

    keep.push(sorted[0]);
    for (let index = 1; index < sorted.length; index += 1) {
      removeIds.push(sorted[index].id);
    }
  }

  const slottedIds = new Set(keep.map((meal) => meal.id));
  for (const meal of meals) {
    if (!slotKey(meal) && !slottedIds.has(meal.id)) {
      keep.push(meal);
    }
  }

  return { keep, removeIds };
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
    .select('id, instructions')
    .eq('user_id', userId)
    .gte('scheduled_date', weekStart)
    .lte('scheduled_date', weekEnd);

  const removeIds = ((data ?? []) as Array<{ id: string; instructions: string | null }>)
    .filter((row) => {
      const status = parseMealStatus(row.instructions);
      return status === 'planned' || status === 'skipped';
    })
    .map((row) => row.id);

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
  let query = db.from('meals').select('id, scheduled_date, meal_type, instructions, created_at').eq('user_id', userId);
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
