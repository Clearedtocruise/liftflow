type MealRow = {
  id: string;
  scheduled_date: string | null;
  meal_type: string;
  instructions: string | null;
  created_at: string;
};

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
  const groups = new Map<string, MealRow[]>();

  for (const row of rows) {
    const key = slotKey(row);
    if (!key) continue;
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  }

  const removeIds: string[] = [];
  for (const group of groups.values()) {
    if (group.length <= 1) continue;
    const sorted = [...group].sort((a, b) => {
      const rankDiff = STATUS_RANK[parseMealStatus(b.instructions)] - STATUS_RANK[parseMealStatus(a.instructions)];
      if (rankDiff !== 0) return rankDiff;
      return b.created_at.localeCompare(a.created_at);
    });
    for (let index = 1; index < sorted.length; index += 1) {
      removeIds.push(sorted[index].id);
    }
  }

  if (removeIds.length === 0) return 0;

  const { error: deleteError } = await db.from('meals').delete().in('id', removeIds);
  if (deleteError) throw new Error(deleteError.message);
  return removeIds.length;
}
