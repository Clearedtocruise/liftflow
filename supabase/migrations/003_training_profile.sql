-- Training profile fields for onboarding + smarter workout generation

alter table public.profiles
  add column if not exists training_location text
    check (training_location in ('home_gym', 'commercial_gym')),
  add column if not exists available_equipment text[] not null default '{}',
  add column if not exists primary_training_goal text
    check (primary_training_goal in ('fat_loss', 'muscle_gain', 'strength', 'general_fitness'));

-- Enrich exercise library with equipment requirements and rotation families
insert into public.exercises (name, slug, category, equipment, muscle_groups, is_system, metadata) values
  ('Push-Up', 'push-up', 'push', 'bodyweight', array['chest', 'triceps', 'shoulders'], true,
    '{"requires":["bodyweight"],"movement_family":"horizontal_press"}'::jsonb),
  ('Band Chest Press', 'band-chest-press', 'push', 'bands', array['chest', 'triceps'], true,
    '{"requires":["bands"],"movement_family":"horizontal_press"}'::jsonb),
  ('Dumbbell Bench Press', 'dumbbell-bench-press', 'push', 'dumbbell', array['chest', 'triceps', 'shoulders'], true,
    '{"requires":["dumbbells","bench"],"movement_family":"horizontal_press"}'::jsonb),
  ('Dumbbell Shoulder Press', 'dumbbell-shoulder-press', 'push', 'dumbbell', array['shoulders', 'triceps'], true,
    '{"requires":["dumbbells"],"movement_family":"vertical_press"}'::jsonb),
  ('Dumbbell Row', 'dumbbell-row', 'pull', 'dumbbell', array['back', 'biceps'], true,
    '{"requires":["dumbbells","bench"],"movement_family":"horizontal_pull"}'::jsonb),
  ('Band Row', 'band-row', 'pull', 'bands', array['back', 'biceps'], true,
    '{"requires":["bands"],"movement_family":"horizontal_pull"}'::jsonb),
  ('Goblet Squat', 'goblet-squat', 'squat', 'dumbbell', array['quads', 'glutes', 'core'], true,
    '{"requires":["dumbbells"],"movement_family":"squat_pattern"}'::jsonb),
  ('Dumbbell Romanian Deadlift', 'dumbbell-rdl', 'hinge', 'dumbbell', array['hamstrings', 'glutes'], true,
    '{"requires":["dumbbells"],"movement_family":"hinge_pattern"}'::jsonb),
  ('Band Pull-Apart', 'band-pull-apart', 'pull', 'bands', array['shoulders', 'back'], true,
    '{"requires":["bands"],"movement_family":"rear_delt"}'::jsonb),
  ('Bodyweight Squat', 'bodyweight-squat', 'squat', 'bodyweight', array['quads', 'glutes'], true,
    '{"requires":["bodyweight"],"movement_family":"squat_pattern"}'::jsonb),
  ('Walking Lunge', 'walking-lunge', 'squat', 'bodyweight', array['quads', 'glutes'], true,
    '{"requires":["bodyweight"],"movement_family":"lunge_pattern"}'::jsonb),
  ('Dumbbell Lunge', 'dumbbell-lunge', 'squat', 'dumbbell', array['quads', 'glutes'], true,
    '{"requires":["dumbbells"],"movement_family":"lunge_pattern"}'::jsonb),
  ('Cable Fly', 'cable-fly', 'push', 'cable', array['chest'], true,
    '{"requires":["machines"],"movement_family":"horizontal_press"}'::jsonb),
  ('Seated Cable Row', 'seated-cable-row', 'pull', 'cable', array['back', 'biceps'], true,
    '{"requires":["machines"],"movement_family":"horizontal_pull"}'::jsonb),
  ('Hack Squat', 'hack-squat', 'squat', 'machine', array['quads', 'glutes'], true,
    '{"requires":["machines"],"movement_family":"squat_pattern"}'::jsonb)
on conflict (slug) do nothing;

update public.exercises set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
  'requires',
  case slug
    when 'bench-press' then '["barbell","bench","rack"]'::jsonb
    when 'incline-bench-press' then '["barbell","bench","rack"]'::jsonb
    when 'overhead-press' then '["barbell","rack"]'::jsonb
    when 'squat' then '["barbell","rack"]'::jsonb
    when 'front-squat' then '["barbell","rack"]'::jsonb
    when 'deadlift' then '["barbell","rack"]'::jsonb
    when 'romanian-deadlift' then '["barbell","rack"]'::jsonb
    when 'barbell-row' then '["barbell","rack"]'::jsonb
    when 'pull-up' then '["pull_up_bar"]'::jsonb
    when 'lat-pulldown' then '["machines"]'::jsonb
    when 'dumbbell-curl' then '["dumbbells"]'::jsonb
    when 'tricep-pushdown' then '["machines"]'::jsonb
    when 'leg-press' then '["machines"]'::jsonb
    when 'leg-curl' then '["machines"]'::jsonb
    when 'calf-raise' then '["machines"]'::jsonb
    when 'plank' then '["bodyweight"]'::jsonb
    else metadata->'requires'
  end,
  'movement_family',
  case slug
    when 'bench-press' then 'horizontal_press'
    when 'incline-bench-press' then 'horizontal_press'
    when 'dumbbell-bench-press' then 'horizontal_press'
    when 'push-up' then 'horizontal_press'
    when 'band-chest-press' then 'horizontal_press'
    when 'cable-fly' then 'horizontal_press'
    when 'overhead-press' then 'vertical_press'
    when 'dumbbell-shoulder-press' then 'vertical_press'
    when 'barbell-row' then 'horizontal_pull'
    when 'dumbbell-row' then 'horizontal_pull'
    when 'band-row' then 'horizontal_pull'
    when 'lat-pulldown' then 'vertical_pull'
    when 'seated-cable-row' then 'horizontal_pull'
    when 'pull-up' then 'vertical_pull'
    when 'squat' then 'squat_pattern'
    when 'front-squat' then 'squat_pattern'
    when 'goblet-squat' then 'squat_pattern'
    when 'leg-press' then 'squat_pattern'
    when 'hack-squat' then 'squat_pattern'
    when 'bodyweight-squat' then 'squat_pattern'
    when 'deadlift' then 'hinge_pattern'
    when 'romanian-deadlift' then 'hinge_pattern'
    when 'dumbbell-rdl' then 'hinge_pattern'
    when 'walking-lunge' then 'lunge_pattern'
    when 'dumbbell-lunge' then 'lunge_pattern'
    when 'dumbbell-curl' then 'biceps'
    when 'tricep-pushdown' then 'triceps'
    when 'plank' then 'core'
    when 'calf-raise' then 'calves'
    when 'leg-curl' then 'hamstrings'
    else metadata->>'movement_family'
  end
)
where is_system = true;
