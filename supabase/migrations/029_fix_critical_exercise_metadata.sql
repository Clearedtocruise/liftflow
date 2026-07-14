-- Targeted catalog corrections for known bad rows after migration 026 name-inference.
-- Safe / idempotent: updates by slug + is_system only.
-- Applied live 2026-07-14 (education_version → 2, education_patch = critical-spotlight).

update public.exercises set
  category = 'hinge'::movement_category,
  equipment = 'bodyweight',
  muscle_groups = array['hamstrings','glutes'],
  secondary_muscles = array['calves','core'],
  exercise_type = 'strength'::exercise_type,
  metadata = coalesce(metadata, '{}'::jsonb) || '{"requires":["bodyweight"],"movement_family":"hinge_pattern","education_corrected_at":"2026-07-14","education_version":2,"education_patch":"critical-spotlight"}'::jsonb,
  updated_at = now()
where slug = 'nordic-curl' and is_system = true;

update public.exercises set
  category = 'pull'::movement_category,
  equipment = 'cable',
  muscle_groups = array['rear delts','rhomboids'],
  secondary_muscles = array['mid traps','rotator cuff'],
  exercise_type = 'strength'::exercise_type,
  metadata = coalesce(metadata, '{}'::jsonb) || '{"requires":["cable"],"movement_family":"rear_delt_fly","education_corrected_at":"2026-07-14","education_version":2,"education_patch":"critical-spotlight"}'::jsonb,
  updated_at = now()
where slug = 'face-pull' and is_system = true;

update public.exercises set
  category = 'pull'::movement_category,
  equipment = 'cable',
  muscle_groups = array['lats','mid back'],
  secondary_muscles = array['biceps','rear delts'],
  exercise_type = 'strength'::exercise_type,
  metadata = coalesce(metadata, '{}'::jsonb) || '{"requires":["cable","lat-pulldown"],"movement_family":"vertical_pull","education_corrected_at":"2026-07-14","education_version":2,"education_patch":"critical-spotlight"}'::jsonb,
  updated_at = now()
where slug = 'lat-pulldown' and is_system = true;

update public.exercises set
  category = 'cardio'::movement_category,
  equipment = 'bodyweight',
  muscle_groups = array['cardiovascular'],
  secondary_muscles = array['quads','glutes','calves'],
  exercise_type = 'cardio'::exercise_type,
  metadata = coalesce(metadata, '{}'::jsonb) || '{"requires":["bodyweight"],"movement_family":"cardio_conditioning","education_corrected_at":"2026-07-14","education_version":2,"education_patch":"critical-spotlight"}'::jsonb,
  updated_at = now()
where slug = 'running' and is_system = true;

update public.exercises set
  category = 'other'::movement_category,
  equipment = 'cable',
  muscle_groups = array['glutes'],
  secondary_muscles = array['hamstrings','core'],
  exercise_type = 'strength'::exercise_type,
  metadata = coalesce(metadata, '{}'::jsonb) || '{"requires":["cable"],"movement_family":"hip_extension","education_corrected_at":"2026-07-14","education_version":2,"education_patch":"critical-spotlight"}'::jsonb,
  updated_at = now()
where slug = 'glute-kickback' and is_system = true;

update public.exercises set
  category = 'other'::movement_category,
  equipment = 'dumbbell',
  muscle_groups = array['shoulders'],
  secondary_muscles = array['upper traps','triceps'],
  exercise_type = 'strength'::exercise_type,
  metadata = coalesce(metadata, '{}'::jsonb) || '{"requires":["dumbbell"],"movement_family":"lateral_raise","education_corrected_at":"2026-07-14","education_version":2,"education_patch":"critical-spotlight"}'::jsonb,
  updated_at = now()
where slug = 'lateral-raise' and is_system = true;

update public.exercises set
  category = 'other'::movement_category,
  equipment = 'machine',
  muscle_groups = array['quads'],
  secondary_muscles = array[]::text[],
  exercise_type = 'strength'::exercise_type,
  metadata = coalesce(metadata, '{}'::jsonb) || '{"requires":["machine"],"movement_family":"knee_extension","education_corrected_at":"2026-07-14","education_version":2,"education_patch":"critical-spotlight"}'::jsonb,
  updated_at = now()
where slug = 'leg-extension' and is_system = true;

update public.exercises set
  category = 'core'::movement_category,
  equipment = 'cable',
  muscle_groups = array['core'],
  secondary_muscles = array['shoulders','glutes'],
  exercise_type = 'strength'::exercise_type,
  metadata = coalesce(metadata, '{}'::jsonb) || '{"requires":["cable"],"movement_family":"anti_rotation","education_corrected_at":"2026-07-14","education_version":2,"education_patch":"critical-spotlight"}'::jsonb,
  updated_at = now()
where slug = 'pallof-press' and is_system = true;

update public.exercises set
  category = 'hinge'::movement_category,
  equipment = 'barbell',
  muscle_groups = array['hamstrings','glutes'],
  secondary_muscles = array['lower back','core'],
  exercise_type = 'strength'::exercise_type,
  metadata = coalesce(metadata, '{}'::jsonb) || '{"requires":["barbell"],"movement_family":"hinge_pattern","education_corrected_at":"2026-07-14","education_version":2,"education_patch":"critical-spotlight"}'::jsonb,
  updated_at = now()
where slug = 'good-morning' and is_system = true;

update public.exercises set
  category = 'core'::movement_category,
  equipment = 'bodyweight',
  muscle_groups = array['core'],
  secondary_muscles = array['obliques','hip flexors'],
  exercise_type = 'strength'::exercise_type,
  metadata = coalesce(metadata, '{}'::jsonb) || '{"requires":["bodyweight"],"movement_family":"core_stability","education_corrected_at":"2026-07-14","education_version":2,"education_patch":"critical-spotlight"}'::jsonb,
  updated_at = now()
where slug = 'russian-twist' and is_system = true;
