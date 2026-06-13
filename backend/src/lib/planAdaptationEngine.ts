import { getProgramDashboard, reschedulePlannedWorkout } from './programEngine.js';
import { syncNutritionForDates, type DayNutritionSync } from './nutritionDaySync.js';
import { requireAdmin } from './supabase.js';

export type ScheduleChangeMove = {
  type: 'move';
  workoutId: string;
  toDate: string;
};

export type ScheduleChange = ScheduleChangeMove;

export type PlanCoachMessage = {
  headline: 'Plan Adjusted';
  messages: string[];
  rationale: string;
};

export type PlanAdaptationResult = {
  changeId: string;
  changeType: ScheduleChange['type'];
  affectedDates: string[];
  fromDate: string;
  toDate: string;
  workoutName: string;
  training: {
    weeklyVolume: number;
    restDays: string[];
  };
  nutrition: {
    byDate: Record<string, DayNutritionSync>;
  };
  coach: PlanCoachMessage;
};

type PlannedRow = {
  id: string;
  name: string;
  scheduled_date: string;
  status: string;
  metadata?: Record<string, unknown> | null;
};

function weekDatesAround(dateStr: string): string[] {
  const d = new Date(`${dateStr}T12:00:00`);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  const dates: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    const cur = new Date(d);
    cur.setDate(d.getDate() + i);
    dates.push(cur.toISOString().slice(0, 10));
  }
  return dates;
}

function formatDayLabel(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
}

function buildMoveCoachMessages(
  workoutName: string,
  fromDate: string,
  toDate: string,
  nutritionByDate: Record<string, DayNutritionSync>,
  swappedWith?: string,
): PlanCoachMessage {
  const messages: string[] = [];
  const fromLabel = formatDayLabel(fromDate);
  const toLabel = formatDayLabel(toDate);

  if (swappedWith) {
    messages.push(`${workoutName} moved to ${toLabel}.`);
    messages.push(`${swappedWith} moved to ${fromLabel}.`);
  } else {
    messages.push(`${workoutName} moved to ${toLabel}.`);
  }

  const fromNutrition = nutritionByDate[fromDate];
  const toNutrition = nutritionByDate[toDate];

  if (fromNutrition && !fromNutrition.isTrainingDay) {
    messages.push(`${fromLabel} switched to recovery nutrition.`);
  }
  if (toNutrition?.isTrainingDay) {
    messages.push(`${toLabel} nutrition targets updated for training.`);
  } else {
    messages.push('Nutrition targets updated.');
  }

  const rationaleParts = [
    swappedWith
      ? `Workouts exchanged between ${fromLabel} and ${toLabel} to keep your weekly structure intact.`
      : `${workoutName} rescheduled from ${fromLabel} to ${toLabel}.`,
    fromNutrition && !fromNutrition.isTrainingDay
      ? `${fromLabel} macros lowered (${fromNutrition.macros.calories} kcal) for recovery.`
      : null,
    toNutrition?.isTrainingDay
      ? `${toLabel} macros raised (${toNutrition.macros.calories} kcal) with pre- and post-workout meals.`
      : null,
    'No manual meal plan regeneration needed — your existing plan was updated in place.',
  ].filter(Boolean);

  return {
    headline: 'Plan Adjusted',
    messages,
    rationale: rationaleParts.join(' '),
  };
}

async function loadWorkout(workoutId: string): Promise<PlannedRow> {
  const db = requireAdmin();
  const { data, error } = await db
    .from('planned_workouts')
    .select('id, name, scheduled_date, status, metadata')
    .eq('id', workoutId)
    .single();
  if (error || !data) throw new Error('Planned workout not found');
  return data as PlannedRow;
}

async function loadWorkoutOnDate(userId: string, date: string, excludeId?: string): Promise<PlannedRow | null> {
  const db = requireAdmin();
  let query = db
    .from('planned_workouts')
    .select('id, name, scheduled_date, status, metadata')
    .eq('user_id', userId)
    .eq('scheduled_date', date)
    .neq('status', 'cancelled');
  if (excludeId) query = query.neq('id', excludeId);
  const { data } = await query.limit(1).maybeSingle();
  return (data as PlannedRow | null) ?? null;
}

async function computeWeeklyVolume(userId: string, referenceDate: string): Promise<number> {
  const db = requireAdmin();
  const weekDates = weekDatesAround(referenceDate);
  const { data } = await db
    .from('planned_workouts')
    .select('metadata, status')
    .eq('user_id', userId)
    .gte('scheduled_date', weekDates[0])
    .lte('scheduled_date', weekDates[6])
    .neq('status', 'cancelled');

  let sets = 0;
  for (const row of data ?? []) {
    if (row.status === 'skipped') continue;
    const exercises = ((row.metadata as { exercises?: Array<{ sets?: number }> })?.exercises ?? []) as Array<{
      sets?: number;
    }>;
    sets += exercises.reduce((sum, ex) => sum + Math.max(ex.sets ?? 0, 0), 0);
  }
  return sets;
}

async function restDaysInWeek(userId: string, referenceDate: string): Promise<string[]> {
  const weekDates = weekDatesAround(referenceDate);
  const db = requireAdmin();
  const { data } = await db
    .from('planned_workouts')
    .select('scheduled_date, status')
    .eq('user_id', userId)
    .gte('scheduled_date', weekDates[0])
    .lte('scheduled_date', weekDates[6])
    .neq('status', 'cancelled')
    .neq('status', 'skipped');

  const trainingDates = new Set((data ?? []).map((r) => r.scheduled_date as string));
  return weekDates.filter((d) => !trainingDates.has(d));
}

async function persistPlanAdjustment(userId: string, coach: PlanCoachMessage, affectedDates: string[]) {
  const db = requireAdmin();
  const { data: profile } = await db.from('profiles').select('metadata').eq('id', userId).maybeSingle();
  const metadata = (profile?.metadata ?? {}) as Record<string, unknown>;
  await db
    .from('profiles')
    .update({
      metadata: {
        ...metadata,
        planAdjustment: {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          affectedDates,
          ...coach,
        },
      },
    })
    .eq('id', userId);
}

export async function applyScheduleChange(userId: string, change: ScheduleChange): Promise<PlanAdaptationResult> {
  if (change.type !== 'move') {
    throw new Error(`Unsupported change type: ${(change as ScheduleChange).type}`);
  }

  const workout = await loadWorkout(change.workoutId);
  const fromDate = workout.scheduled_date;
  const toDate = change.toDate;

  if (fromDate === toDate) {
    throw new Error('Workout is already scheduled on that date');
  }

  let swappedWith: string | undefined;
  const destWorkout = await loadWorkoutOnDate(userId, toDate, workout.id);
  if (destWorkout) {
    swappedWith = destWorkout.name;
    await reschedulePlannedWorkout(destWorkout.id, fromDate);
  }

  await reschedulePlannedWorkout(workout.id, toDate);

  const affectedDates = [...new Set([fromDate, toDate])];
  const nutritionResults = await syncNutritionForDates(userId, affectedDates);
  const nutritionByDate = Object.fromEntries(nutritionResults.map((n) => [n.date, n]));

  const coach = buildMoveCoachMessages(workout.name, fromDate, toDate, nutritionByDate, swappedWith);
  await persistPlanAdjustment(userId, coach, affectedDates);

  // Touch dashboard cache indirectly — callers refresh program state
  void getProgramDashboard(userId);

  return {
    changeId: crypto.randomUUID(),
    changeType: 'move',
    affectedDates,
    fromDate,
    toDate,
    workoutName: workout.name,
    training: {
      weeklyVolume: await computeWeeklyVolume(userId, toDate),
      restDays: await restDaysInWeek(userId, toDate),
    },
    nutrition: { byDate: nutritionByDate },
    coach,
  };
}
