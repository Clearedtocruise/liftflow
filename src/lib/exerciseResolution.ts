/** Maps display names to seeded exercise slugs in Supabase. */
export const EXERCISE_NAME_TO_SLUG: Record<string, string> = {
  'barbell back squat': 'squat',
  'back squat': 'squat',
  squat: 'squat',
  'barbell bench press': 'bench-press',
  'bench press': 'bench-press',
  'incline bench press': 'incline-bench-press',
  'incline dumbbell press': 'dumbbell-bench-press',
  'dumbbell bench press': 'dumbbell-bench-press',
  'overhead press': 'overhead-press',
  'barbell row': 'barbell-row',
  'romanian deadlift': 'romanian-deadlift',
  'leg press': 'leg-press',
  'leg curl': 'leg-curl',
  'walking lunge': 'walking-lunge',
  'dumbbell lunge': 'dumbbell-lunge',
  'bulgarian split squat': 'walking-lunge',
  'pull-up': 'pull-up',
  'pull up': 'pull-up',
  'chin-up': 'pull-up',
  'lat pulldown': 'lat-pulldown',
  'dumbbell curl': 'dumbbell-curl',
  'tricep pushdown': 'tricep-pushdown',
  'triceps pushdown': 'tricep-pushdown',
  'cable chest fly': 'cable-fly',
  'cable fly': 'cable-fly',
  'dumbbell fly': 'cable-fly',
  'standing calf raise': 'calf-raise',
  'seated calf raise': 'calf-raise',
  'calf raise': 'calf-raise',
  plank: 'plank',
  deadlift: 'deadlift',
  'front squat': 'front-squat',
  'goblet squat': 'goblet-squat',
  'hip thrust': 'romanian-deadlift',
  'leg extension': 'leg-press',
  'lateral raise': 'dumbbell-shoulder-press',
  'front raise': 'dumbbell-shoulder-press',
  'skull crusher': 'tricep-pushdown',
  'skull crushers': 'tricep-pushdown',
  'overhead tricep extension': 'tricep-pushdown',
  'face pull': 'band-pull-apart',
  'push-up': 'push-up',
};

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function resolveExerciseSlug(name: string): string {
  const key = name.trim().toLowerCase();
  return EXERCISE_NAME_TO_SLUG[key] ?? slugify(name);
}

export type MovementCategory = 'push' | 'pull' | 'squat' | 'hinge' | 'carry' | 'cardio' | 'core' | 'other';

/** Best-effort category when creating a user exercise row. */
export function inferMovementCategory(name: string): MovementCategory {
  const lower = name.toLowerCase();
  if (/(squat|lunge|leg press|leg extension)/.test(lower)) return 'squat';
  if (/(deadlift|rdl|hinge|curl|leg curl)/.test(lower)) return 'hinge';
  if (/(row|pull|chin|lat|face pull)/.test(lower)) return 'pull';
  if (/(press|fly|push|tricep|shoulder|chest)/.test(lower)) return 'push';
  if (/(plank|core|crunch)/.test(lower)) return 'core';
  if (/(run|cardio|bike|rower)/.test(lower)) return 'cardio';
  return 'other';
}
