/**
 * Next-week workout preview — uses program plan or adaptive generation.
 */
import { loadRecoveryIntelligence } from './loadRecoveryIntelligence.js';
import { requireAdmin } from './supabase.js';
import { buildAdaptiveWorkoutPlan } from './workoutPlanner.js';

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export type NextWeekDayPreview = {
  date: string;
  dayLabel: string;
  title: string;
  muscleGroups: string[];
  exerciseCount: number;
};

export async function buildNextWeekWorkoutPreview(
  userId: string,
  nextWeekStart: string,
): Promise<{ focus: string; days: NextWeekDayPreview[] }> {
  const db = requireAdmin();
  const nextWeekEnd = addDays(nextWeekStart, 6);

  const { data: planned } = await db
    .from('planned_workouts')
    .select('scheduled_date, name, suggested_muscle_groups, metadata, status')
    .eq('user_id', userId)
    .gte('scheduled_date', nextWeekStart)
    .lte('scheduled_date', nextWeekEnd)
    .order('scheduled_date');

  if (planned && planned.length >= 4) {
    const days = planned.map((row, index) => {
      const meta = row.metadata as { exercises?: unknown[]; slotLabel?: string; dayLabel?: string } | null;
      return {
        date: row.scheduled_date,
        dayLabel: DAY_LABELS[index] ?? 'Day',
        title: meta?.slotLabel ?? meta?.dayLabel ?? row.name,
        muscleGroups: row.suggested_muscle_groups ?? [],
        exerciseCount: meta?.exercises?.length ?? 0,
      };
    });
    const focus = inferFocusFromDays(days);
    return { focus, days };
  }

  let intelligence;
  try {
    intelligence = await loadRecoveryIntelligence(userId);
  } catch {
    intelligence = null;
  }

  const muscles =
    intelligence?.suggestedMuscleGroups?.length
      ? intelligence.suggestedMuscleGroups
      : ['legs', 'back', 'chest'];

  const adaptive = await buildAdaptiveWorkoutPlan(userId, muscles, 'Next week adaptive plan', {
    targetExerciseCount: 10,
  });

  const days: NextWeekDayPreview[] = DAY_LABELS.map((dayLabel, index) => {
    const date = addDays(nextWeekStart, index);
    if (index === 6) {
      return { date, dayLabel, title: 'Recovery', muscleGroups: ['core'], exerciseCount: 0 };
    }
    const templateIndex = index % 6;
    const titles = [
      'Lower Strength',
      'Push Hypertrophy',
      'Pull Strength',
      'Legs / Core',
      'Upper Hypertrophy',
      'Lower Burnout',
    ];
    return {
      date,
      dayLabel,
      title: titles[templateIndex] ?? adaptive.name,
      muscleGroups: muscles.slice(0, 2),
      exerciseCount: Math.min(adaptive.exercises.length, 10),
    };
  });

  return {
    focus: `Legs and ${muscles.includes('back') ? 'back' : 'upper'} volume`,
    days,
  };
}

function inferFocusFromDays(days: NextWeekDayPreview[]): string {
  const groups = new Set(days.flatMap((d) => d.muscleGroups.map((g) => g.toLowerCase())));
  if (groups.has('legs') || groups.has('quads') || groups.has('glutes')) return 'Legs and back volume';
  if (groups.has('chest') && groups.has('back')) return 'Upper body balance';
  return 'Progressive overload across primary lifts';
}
