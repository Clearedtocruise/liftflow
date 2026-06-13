-- Sprint 1 — Exercise classification engine
-- Adds exercise_type column and classifies all system exercises.

create type public.exercise_type as enum ('strength', 'bodyweight', 'timed', 'cardio');

alter table public.exercises
  add column if not exists exercise_type public.exercise_type not null default 'strength';

-- New catalog entries (cardio + timed)
insert into public.exercises (name, slug, category, equipment, muscle_groups, is_system, exercise_type, metadata) values
  ('Side Plank', 'side-plank', 'core', 'bodyweight', array['core', 'obliques'], true, 'timed',
    '{"requires":["bodyweight"],"movement_family":"core"}'::jsonb),
  ('Running', 'running', 'cardio', 'none', array['legs', 'cardiovascular'], true, 'cardio', '{}'::jsonb),
  ('Swimming', 'swimming', 'cardio', 'none', array['full_body', 'cardiovascular'], true, 'cardio', '{}'::jsonb),
  ('Cycling', 'cycling', 'cardio', 'bike', array['legs', 'cardiovascular'], true, 'cardio', '{}'::jsonb),
  ('Rowing', 'rowing', 'cardio', 'rower', array['back', 'legs', 'cardiovascular'], true, 'cardio', '{}'::jsonb),
  ('Recovery Walk', 'recovery-walk', 'cardio', 'none', array['legs', 'cardiovascular'], true, 'cardio', '{}'::jsonb)
on conflict (slug) do update set
  exercise_type = excluded.exercise_type,
  category = excluded.category,
  equipment = excluded.equipment,
  muscle_groups = excluded.muscle_groups,
  metadata = excluded.metadata;

-- Backfill existing system exercises by slug
update public.exercises set exercise_type = 'strength' where slug in (
  'bench-press', 'incline-bench-press', 'overhead-press', 'squat', 'front-squat',
  'deadlift', 'romanian-deadlift', 'barbell-row', 'lat-pulldown', 'dumbbell-curl',
  'tricep-pushdown', 'leg-press', 'leg-curl', 'calf-raise', 'band-chest-press',
  'dumbbell-bench-press', 'dumbbell-shoulder-press', 'dumbbell-row', 'band-row',
  'goblet-squat', 'dumbbell-rdl', 'band-pull-apart', 'dumbbell-lunge',
  'cable-fly', 'seated-cable-row', 'hack-squat'
);

update public.exercises set exercise_type = 'bodyweight' where slug in (
  'pull-up', 'push-up', 'bodyweight-squat', 'walking-lunge'
);

update public.exercises set exercise_type = 'timed' where slug in (
  'plank', 'side-plank'
);

update public.exercises set exercise_type = 'cardio' where slug in (
  'running', 'swimming', 'cycling', 'rowing', 'recovery-walk'
);

-- Classify any remaining system exercises by movement category
update public.exercises
set exercise_type = 'cardio'
where is_system = true
  and category = 'cardio'
  and exercise_type = 'strength';

comment on column public.exercises.exercise_type is
  'Sprint 1 classification: strength | bodyweight | timed | cardio';
