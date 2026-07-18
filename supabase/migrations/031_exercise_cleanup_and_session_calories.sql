-- ONE MORE stability sprint: exercise typing cleanup + strength session active calories.

-- Pull-up family: bodyweight strength (sets/reps), not cardio/timed.
update public.exercises
set
  exercise_type = 'bodyweight'::exercise_type,
  equipment = coalesce(nullif(equipment, ''), 'bodyweight'),
  updated_at = now()
where is_system = true
  and (
    slug like '%pull-up%'
    or slug like '%chin-up%'
    or name ilike '%pull-up%'
    or name ilike '%chin-up%'
  )
  and exercise_type is distinct from 'bodyweight'::exercise_type;

-- Commando Pull-Up: ensure bodyweight + pull muscles.
update public.exercises
set
  exercise_type = 'bodyweight'::exercise_type,
  category = 'pull'::movement_category,
  equipment = 'bodyweight',
  muscle_groups = array['lats', 'mid back'],
  secondary_muscles = array['biceps', 'rear delts'],
  updated_at = now()
where slug in ('commando-pull-up', 'commando-pull-up-la0408')
  and is_system = true;

-- Clarify confusing hammer-curl naming when reverse-grip variants exist.
update public.exercises
set
  name = 'Reverse-Grip Hammer Curl',
  updated_at = now()
where is_system = true
  and (
    slug = 'reverse-grip-hammer-curl'
    or name ilike 'reverse grip hammer curl'
  );

-- Holds / planks: timed.
update public.exercises
set
  exercise_type = 'timed'::exercise_type,
  updated_at = now()
where is_system = true
  and exercise_type is distinct from 'timed'::exercise_type
  and (
    name ~* '\y(plank|wall sit|dead hang|hollow hold|l-sit|iso hold|static hold)\y'
    or slug ~* '(plank|wall-sit|dead-hang|hollow-hold|l-sit)'
  );

-- Store active calories on strength sessions (from Watch / HealthKit).
alter table public.workout_sessions
  add column if not exists calories_burned integer;

comment on column public.workout_sessions.calories_burned is
  'Active calories for the session (Apple Health / Watch), not total including basal.';
