import { syncNutritionForDates, type DayNutritionSync } from './nutritionDaySync.js';
import { getProgramDashboard, reschedulePlannedWorkout } from './programEngine.js';
import { requireAdmin } from './supabase.js';

export type ScheduleChangeMove = {
  type: 'move';
  workoutId: string;
  toDate: string;
};

export type ScheduleChangeSwap = {
  type: 'swap';
  workoutIdA: string;
  workoutIdB: string;
};

export type ScheduleChangeSkip = {
  type: 'skip';
  workoutId: string;
};

export type CardioActivity = 'running' | 'swimming' | 'cycling' | 'sport' | 'conditioning';

export type ScheduleChangeToCardio = {
  type: 'to_cardio';
  workoutId: string;
  activity: CardioActivity;
};

export type ScheduleChangeToRecovery = {
  type: 'to_recovery';
  workoutId: string;
};

export type ScheduleChange =
  | ScheduleChangeMove
  | ScheduleChangeSwap
  | ScheduleChangeSkip
  | ScheduleChangeToCardio
  | ScheduleChangeToRecovery;

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
    volumeRedistributedTo?: string;
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
  ai_rationale?: string | null;
  metadata?: Record<string, unknown> | null;
};

type PlannedExercise = {
  name: string;
  sets: number;
  reps: string;
  weightLbs?: number;
  restSeconds: number;
  notes?: string;
};

const CARDIO_ACTIVITIES: Record<
  CardioActivity,
  { label: string; cardioType: string; nameSuffix: string }
> = {
  running: { label: 'Running', cardioType: 'run', nameSuffix: 'Running Session' },
  swimming: { label: 'Swimming', cardioType: 'swim', nameSuffix: 'Swimming Session' },
  cycling: { label: 'Cycling', cardioType: 'cycle', nameSuffix: 'Cycling Session' },
  sport: { label: 'Sport Activity', cardioType: 'other', nameSuffix: 'Sport Activity' },
  conditioning: { label: 'Conditioning', cardioType: 'hiit', nameSuffix: 'Conditioning / HIIT' },
};

const RECOVERY_EXERCISES: PlannedExercise[] = [
  { name: 'Cat-Cow Stretch', sets: 2, reps: '10', restSeconds: 30, notes: 'Recovery flow' },
  { name: 'Hip Flexor Stretch', sets: 2, reps: '45 sec', restSeconds: 30 },
  { name: 'Band Pull-Aparts', sets: 2, reps: '15', restSeconds: 45 },
  { name: 'Walking Lunges', sets: 2, reps: '10/leg', restSeconds: 45, notes: 'Controlled tempo' },
];

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

  appendNutritionMessages(messages, fromDate, toDate, nutritionByDate);

  const rationaleParts = [
    swappedWith
      ? `Workouts exchanged between ${fromLabel} and ${toLabel} to keep your weekly structure intact.`
      : `${workoutName} rescheduled from ${fromLabel} to ${toLabel}.`,
    nutritionRationale(fromDate, toDate, nutritionByDate),
    'No manual meal plan regeneration needed — your existing plan was updated in place.',
  ].filter(Boolean);

  return { headline: 'Plan Adjusted', messages, rationale: rationaleParts.join(' ') };
}

function buildSwapCoachMessages(
  workoutA: PlannedRow,
  workoutB: PlannedRow,
  nutritionByDate: Record<string, DayNutritionSync>,
): PlanCoachMessage {
  const dateA = workoutA.scheduled_date;
  const dateB = workoutB.scheduled_date;
  const messages = [
    `${workoutA.name} ↔ ${workoutB.name} days swapped.`,
    `${formatDayLabel(dateA)} nutrition now matches ${workoutB.name}.`,
    `${formatDayLabel(dateB)} nutrition now matches ${workoutA.name}.`,
  ];

  return {
    headline: 'Plan Adjusted',
    messages,
    rationale: [
      `Swapped ${workoutA.name} (${formatDayLabel(dateA)}) with ${workoutB.name} (${formatDayLabel(dateB)}).`,
      nutritionRationale(dateA, dateB, nutritionByDate),
    ].join(' '),
  };
}

function buildSkipCoachMessages(
  workout: PlannedRow,
  skippedDate: string,
  nutritionByDate: Record<string, DayNutritionSync>,
  volumeRedistributedTo?: string,
): PlanCoachMessage {
  const dayLabel = formatDayLabel(skippedDate);
  const messages = [
    `${workout.name} skipped.`,
    `${dayLabel} switched to recovery nutrition.`,
    'Nutrition targets updated.',
  ];
  if (volumeRedistributedTo) {
    messages.push(`Remaining volume partially added to ${volumeRedistributedTo}.`);
  }

  const rationaleParts = [
    `${workout.name} on ${dayLabel} was skipped — rest-day macros applied.`,
    nutritionByDate[skippedDate]
      ? `${dayLabel} targets: ${nutritionByDate[skippedDate].macros.calories} kcal.`
      : null,
    volumeRedistributedTo
      ? `A portion of skipped volume was redistributed to your next session to stay on weekly targets.`
      : 'Your remaining weekly sessions stay unchanged.',
  ].filter(Boolean);

  return { headline: 'Plan Adjusted', messages, rationale: rationaleParts.join(' ') };
}

function buildCardioCoachMessages(
  activity: CardioActivity,
  workout: PlannedRow,
  date: string,
  nutritionByDate: Record<string, DayNutritionSync>,
  nextLift?: string,
): PlanCoachMessage {
  const label = CARDIO_ACTIVITIES[activity].label;
  const dayLabel = formatDayLabel(date);
  const messages = [
    `${workout.name} converted to ${label.toLowerCase()}.`,
    `${dayLabel} carbs increased for endurance fuel.`,
    'Nutrition targets updated.',
  ];
  if (nextLift) messages.push(`Next lifting session: ${nextLift}.`);

  const dayNutrition = nutritionByDate[date];
  return {
    headline: 'Plan Adjusted',
    messages,
    rationale: [
      `Strength session replaced with ${label} on ${dayLabel}.`,
      dayNutrition ? `Target ${dayNutrition.macros.calories} kcal with higher carbs and hydration.` : null,
      nextLift ? `${nextLift} stays on schedule.` : null,
    ]
      .filter(Boolean)
      .join(' '),
  };
}

function buildRecoveryCoachMessages(
  workout: PlannedRow,
  date: string,
  nutritionByDate: Record<string, DayNutritionSync>,
  nextLift?: string,
): PlanCoachMessage {
  const dayLabel = formatDayLabel(date);
  const messages = [
    `${workout.name} converted to a recovery session.`,
    'Recovery day activated.',
    'Nutrition targets updated.',
  ];
  if (nextLift) messages.push(`Next lifting session: ${nextLift}.`);

  const dayNutrition = nutritionByDate[date];
  return {
    headline: 'Plan Adjusted',
    messages,
    rationale: [
      `${dayLabel} switched to mobility-focused work with moderate macros.`,
      dayNutrition ? `${dayNutrition.macros.calories} kcal · ${dayNutrition.macros.proteinG}g protein.` : null,
      nextLift ? `Preserve quality for ${nextLift} — today prioritizes tissue recovery over load.` : null,
    ]
      .filter(Boolean)
      .join(' '),
  };
}

async function findNextLiftingSession(userId: string, afterDate: string): Promise<string | undefined> {
  const db = requireAdmin();
  const { data } = await db
    .from('planned_workouts')
    .select('name, metadata')
    .eq('user_id', userId)
    .gt('scheduled_date', afterDate)
    .eq('status', 'planned')
    .order('scheduled_date', { ascending: true })
    .limit(5);

  for (const row of data ?? []) {
    const kind = (row.metadata as { sessionKind?: string })?.sessionKind;
    if (kind !== 'cardio' && kind !== 'mobility') return row.name as string;
  }
  return undefined;
}

function appendNutritionMessages(
  messages: string[],
  fromDate: string,
  toDate: string,
  nutritionByDate: Record<string, DayNutritionSync>,
) {
  const fromNutrition = nutritionByDate[fromDate];
  const toNutrition = nutritionByDate[toDate];
  if (fromNutrition && !fromNutrition.isTrainingDay) {
    messages.push(`${formatDayLabel(fromDate)} switched to recovery nutrition.`);
  }
  if (toNutrition?.isTrainingDay) {
    messages.push(`${formatDayLabel(toDate)} nutrition targets updated for training.`);
  } else if (fromDate !== toDate) {
    messages.push('Nutrition targets updated.');
  }
}

function nutritionRationale(
  dateA: string,
  dateB: string,
  nutritionByDate: Record<string, DayNutritionSync>,
): string | null {
  const parts: string[] = [];
  const a = nutritionByDate[dateA];
  const b = nutritionByDate[dateB];
  if (a && !a.isTrainingDay) parts.push(`${formatDayLabel(dateA)} macros lowered (${a.macros.calories} kcal).`);
  if (b?.isTrainingDay) parts.push(`${formatDayLabel(dateB)} macros raised (${b.macros.calories} kcal).`);
  return parts.length ? parts.join(' ') : null;
}

async function loadWorkout(workoutId: string): Promise<PlannedRow> {
  const db = requireAdmin();
  const { data, error } = await db
    .from('planned_workouts')
    .select('id, name, scheduled_date, status, ai_rationale, metadata')
    .eq('id', workoutId)
    .single();
  if (error || !data) throw new Error('Planned workout not found');
  return data as PlannedRow;
}

async function loadWorkoutOnDate(userId: string, date: string, excludeId?: string): Promise<PlannedRow | null> {
  const db = requireAdmin();
  let query = db
    .from('planned_workouts')
    .select('id, name, scheduled_date, status, ai_rationale, metadata')
    .eq('user_id', userId)
    .eq('scheduled_date', date)
    .in('status', ['planned', 'active', 'paused']);
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
    .eq('status', 'planned');

  let sets = 0;
  for (const row of data ?? []) {
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
    .eq('status', 'planned');

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

function assertMovableWorkout(status: string, action: 'moved' | 'swapped' | 'skipped'): void {
  if (status === 'planned' || status === 'active' || status === 'paused') return;
  if (status === 'completed') {
    throw new Error(`Completed workouts can't be ${action}. Pick an upcoming day, or rebuild your week in Settings.`);
  }
  throw new Error(`Only upcoming workouts can be ${action}`);
}

async function clearActiveWorkoutState(workoutId: string, status: string): Promise<void> {
  if (status !== 'active' && status !== 'paused') return;
  const db = requireAdmin();
  await db.from('planned_workouts').update({ status: 'planned' }).eq('id', workoutId);
}

async function applyMove(userId: string, change: ScheduleChangeMove): Promise<PlanAdaptationResult> {
  const workout = await loadWorkout(change.workoutId);
  const fromDate = workout.scheduled_date;
  const toDate = change.toDate;

  if (fromDate === toDate) {
    throw new Error('Workout is already scheduled on that date');
  }
  assertMovableWorkout(workout.status, 'moved');

  let swappedWith: string | undefined;
  const destWorkout = await loadWorkoutOnDate(userId, toDate, workout.id);
  if (destWorkout) {
    assertMovableWorkout(destWorkout.status, 'moved');
    swappedWith = destWorkout.name;
    await reschedulePlannedWorkout(destWorkout.id, fromDate);
    await clearActiveWorkoutState(destWorkout.id, destWorkout.status);
  }

  await reschedulePlannedWorkout(workout.id, toDate);
  await clearActiveWorkoutState(workout.id, workout.status);

  const affectedDates = [...new Set([fromDate, toDate])];
  // Nutrition/macros sync in background — awaiting it froze day swaps for many seconds.
  const nutritionByDate: Record<string, DayNutritionSync> = {};
  const coach = buildMoveCoachMessages(workout.name, fromDate, toDate, nutritionByDate, swappedWith);
  await persistPlanAdjustment(userId, coach, affectedDates);
  void syncNutritionForDates(userId, affectedDates);
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

async function applySwap(userId: string, change: ScheduleChangeSwap): Promise<PlanAdaptationResult> {
  const workoutA = await loadWorkout(change.workoutIdA);
  const workoutB = await loadWorkout(change.workoutIdB);

  if (workoutA.id === workoutB.id) {
    throw new Error('Choose two different workouts to swap');
  }
  assertMovableWorkout(workoutA.status, 'swapped');
  assertMovableWorkout(workoutB.status, 'swapped');

  const dateA = workoutA.scheduled_date;
  const dateB = workoutB.scheduled_date;

  await reschedulePlannedWorkout(workoutA.id, dateB);
  await reschedulePlannedWorkout(workoutB.id, dateA);
  await clearActiveWorkoutState(workoutA.id, workoutA.status);
  await clearActiveWorkoutState(workoutB.id, workoutB.status);

  const affectedDates = [...new Set([dateA, dateB])];
  const nutritionByDate: Record<string, DayNutritionSync> = {};

  const coach = buildSwapCoachMessages(
    { ...workoutA, scheduled_date: dateB },
    { ...workoutB, scheduled_date: dateA },
    nutritionByDate,
  );

  await persistPlanAdjustment(userId, coach, affectedDates);
  void syncNutritionForDates(userId, affectedDates);
  void getProgramDashboard(userId);

  return {
    changeId: crypto.randomUUID(),
    changeType: 'swap',
    affectedDates,
    fromDate: dateA,
    toDate: dateB,
    workoutName: workoutA.name,
    training: {
      weeklyVolume: await computeWeeklyVolume(userId, dateB),
      restDays: await restDaysInWeek(userId, dateB),
    },
    nutrition: { byDate: nutritionByDate },
    coach,
  };
}

async function redistributeVolumeAfterSkip(
  userId: string,
  skippedDate: string,
  skippedWorkout: PlannedRow,
): Promise<string | undefined> {
  const skippedExercises = ((skippedWorkout.metadata?.exercises ?? []) as PlannedExercise[]) ?? [];
  const skippedSets = skippedExercises.reduce((sum, ex) => sum + Math.max(ex.sets ?? 0, 0), 0);
  if (skippedSets === 0) return undefined;

  const db = requireAdmin();
  const { data: next } = await db
    .from('planned_workouts')
    .select('id, name, metadata, ai_rationale')
    .eq('user_id', userId)
    .gt('scheduled_date', skippedDate)
    .eq('status', 'planned')
    .order('scheduled_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!next) return undefined;

  const meta = (next.metadata ?? {}) as { exercises?: PlannedExercise[] };
  if (!meta.exercises?.length) return undefined;

  const bonusSets = Math.max(1, Math.round(skippedSets * 0.1));
  const lastIndex = meta.exercises.length - 1;
  const exercises = meta.exercises.map((ex, index) => {
    if (index !== lastIndex) return ex;
    return {
      ...ex,
      sets: ex.sets + bonusSets,
      notes: [ex.notes, `+${bonusSets} sets from skipped session`].filter(Boolean).join(' · '),
    };
  });

  await db
    .from('planned_workouts')
    .update({
      metadata: { ...meta, exercises, volumeRedistributedFrom: skippedWorkout.id },
      ai_rationale: `${next.ai_rationale ?? ''} · Volume partially redistributed from skipped ${skippedWorkout.name}`.trim(),
    })
    .eq('id', next.id);

  return next.name as string;
}

async function applySkip(userId: string, change: ScheduleChangeSkip): Promise<PlanAdaptationResult> {
  const workout = await loadWorkout(change.workoutId);
  const skippedDate = workout.scheduled_date;

  assertMovableWorkout(workout.status, 'skipped');

  const db = requireAdmin();
  await db
    .from('planned_workouts')
    .update({
      status: 'cancelled',
      metadata: {
        ...(workout.metadata ?? {}),
        userSkipped: true,
        skippedAt: new Date().toISOString(),
      },
      ai_rationale: `${workout.ai_rationale ?? ''} · Skipped by athlete — recovery day activated`.trim(),
    })
    .eq('id', workout.id);

  const volumeRedistributedTo = await redistributeVolumeAfterSkip(userId, skippedDate, workout);

  const affectedDates = [skippedDate];
  const nutritionResults = await syncNutritionForDates(userId, affectedDates);
  const nutritionByDate = Object.fromEntries(nutritionResults.map((n) => [n.date, n]));
  const coach = buildSkipCoachMessages(workout, skippedDate, nutritionByDate, volumeRedistributedTo);

  await persistPlanAdjustment(userId, coach, affectedDates);
  void getProgramDashboard(userId);

  return {
    changeId: crypto.randomUUID(),
    changeType: 'skip',
    affectedDates,
    fromDate: skippedDate,
    toDate: skippedDate,
    workoutName: workout.name,
    training: {
      weeklyVolume: await computeWeeklyVolume(userId, skippedDate),
      restDays: await restDaysInWeek(userId, skippedDate),
      volumeRedistributedTo,
    },
    nutrition: { byDate: nutritionByDate },
    coach,
  };
}

async function applyToCardio(userId: string, change: ScheduleChangeToCardio): Promise<PlanAdaptationResult> {
  const workout = await loadWorkout(change.workoutId);
  const date = workout.scheduled_date;

  if (workout.status !== 'planned') {
    throw new Error('Only planned workouts can be converted');
  }

  const activity = CARDIO_ACTIVITIES[change.activity];
  const meta = (workout.metadata ?? {}) as Record<string, unknown>;
  const slotLabel = (meta.slotLabel as string | undefined) ?? workout.name;

  const db = requireAdmin();
  await db
    .from('planned_workouts')
    .update({
      name: `${slotLabel} — ${activity.nameSuffix}`,
      suggested_muscle_groups: ['cardio'],
      metadata: {
        ...meta,
        sessionKind: 'cardio',
        cardioType: activity.cardioType,
        convertedFrom: 'strength',
        convertedActivity: change.activity,
        convertedAt: new Date().toISOString(),
        exercises: [],
        previousExercises: meta.exercises,
      },
      ai_rationale: `${workout.ai_rationale ?? ''} · Converted to ${activity.label}`.trim(),
    })
    .eq('id', workout.id);

  const nextLift = await findNextLiftingSession(userId, date);
  const affectedDates = [date];
  const nutritionResults = await syncNutritionForDates(userId, affectedDates);
  const nutritionByDate = Object.fromEntries(nutritionResults.map((n) => [n.date, n]));
  const coach = buildCardioCoachMessages(change.activity, workout, date, nutritionByDate, nextLift);

  await persistPlanAdjustment(userId, coach, affectedDates);
  void getProgramDashboard(userId);

  return {
    changeId: crypto.randomUUID(),
    changeType: 'to_cardio',
    affectedDates,
    fromDate: date,
    toDate: date,
    workoutName: workout.name,
    training: {
      weeklyVolume: await computeWeeklyVolume(userId, date),
      restDays: await restDaysInWeek(userId, date),
    },
    nutrition: { byDate: nutritionByDate },
    coach,
  };
}

async function applyToRecovery(userId: string, change: ScheduleChangeToRecovery): Promise<PlanAdaptationResult> {
  const workout = await loadWorkout(change.workoutId);
  const date = workout.scheduled_date;

  if (workout.status !== 'planned') {
    throw new Error('Only planned workouts can be converted');
  }

  const meta = (workout.metadata ?? {}) as Record<string, unknown>;
  const slotLabel = (meta.slotLabel as string | undefined) ?? workout.name;

  const db = requireAdmin();
  await db
    .from('planned_workouts')
    .update({
      name: `${slotLabel} — Recovery Session`,
      suggested_muscle_groups: ['mobility'],
      metadata: {
        ...meta,
        sessionKind: 'mobility',
        convertedFrom: 'strength',
        convertedAt: new Date().toISOString(),
        exercises: RECOVERY_EXERCISES,
        previousExercises: meta.exercises,
      },
      ai_rationale: `${workout.ai_rationale ?? ''} · Recovery session — mobility and tissue restoration`.trim(),
    })
    .eq('id', workout.id);

  const nextLift = await findNextLiftingSession(userId, date);
  const affectedDates = [date];
  const nutritionResults = await syncNutritionForDates(userId, affectedDates);
  const nutritionByDate = Object.fromEntries(nutritionResults.map((n) => [n.date, n]));
  const coach = buildRecoveryCoachMessages(workout, date, nutritionByDate, nextLift);

  await persistPlanAdjustment(userId, coach, affectedDates);
  void getProgramDashboard(userId);

  return {
    changeId: crypto.randomUUID(),
    changeType: 'to_recovery',
    affectedDates,
    fromDate: date,
    toDate: date,
    workoutName: workout.name,
    training: {
      weeklyVolume: await computeWeeklyVolume(userId, date),
      restDays: await restDaysInWeek(userId, date),
    },
    nutrition: { byDate: nutritionByDate },
    coach,
  };
}

export async function applyScheduleChange(userId: string, change: ScheduleChange): Promise<PlanAdaptationResult> {
  switch (change.type) {
    case 'move':
      return applyMove(userId, change);
    case 'swap':
      return applySwap(userId, change);
    case 'skip':
      return applySkip(userId, change);
    case 'to_cardio':
      return applyToCardio(userId, change);
    case 'to_recovery':
      return applyToRecovery(userId, change);
    default:
      throw new Error(`Unsupported change type: ${(change as ScheduleChange).type}`);
  }
}
