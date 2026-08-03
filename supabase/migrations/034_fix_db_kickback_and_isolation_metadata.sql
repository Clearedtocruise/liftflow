-- DB Kickback was catalogued as a horizontal press (bench-press load factors).
-- Restore triceps isolation metadata so suggested/target loads stay accessory-scale.
update public.exercises
set
  category = 'push'::movement_category,
  muscle_groups = array['triceps'],
  secondary_muscles = array['shoulders'],
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'movement_family', 'triceps',
    'requires', case
      when equipment = 'dumbbell' then '["dumbbells"]'::jsonb
      when equipment = 'cable' or equipment = 'machine' then '["machines"]'::jsonb
      when equipment = 'bodyweight' then '["bodyweight"]'::jsonb
      when equipment = 'barbell' then '["barbell"]'::jsonb
      else coalesce(metadata->'requires', '[]'::jsonb)
    end,
    'education_corrected_at', '2026-07-30',
    'education_version', 2
  ),
  updated_at = now()
where is_system = true
  and (
    slug = 'db-kickback'
    or slug like 'db-kickback-%'
    or lower(name) in ('db kickback', 'dumbbell kickback', 'triceps kickback', 'tricep kickback')
  );

-- Cable kickback rows are glute isolation; 027 only corrected glute-kickback% slugs.
update public.exercises
set
  category = 'hinge'::movement_category,
  muscle_groups = array['glutes'],
  secondary_muscles = array['hamstrings'],
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'movement_family', 'glute_pattern',
    'requires', case
      when equipment = 'bodyweight' then '["bodyweight"]'::jsonb
      when equipment = 'dumbbell' then '["dumbbells"]'::jsonb
      when equipment = 'barbell' then '["barbell"]'::jsonb
      when equipment = 'machine' or equipment = 'cable' then '["machines"]'::jsonb
      else coalesce(metadata->'requires', '[]'::jsonb)
    end,
    'education_corrected_at', '2026-07-30',
    'education_version', 2
  ),
  updated_at = now()
where is_system = true
  and (
    slug like 'cable-kickback%'
    or lower(name) in ('cable kickback', 'cable glute kickback')
  );

-- Light triceps isolation that was mis-tagged as a compound horizontal press.
update public.exercises
set
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'movement_family', 'triceps',
    'education_corrected_at', '2026-07-30',
    'education_version', 2
  ),
  updated_at = now()
where is_system = true
  and coalesce(metadata->>'movement_family', '') = 'horizontal_press'
  and (
    slug in (
      'overhead-db-extension',
      'skull-crusher',
      'db-skull-crusher',
      'smith-skull-crusher',
      'trap-bar-skull-crusher',
      'ring-skull-crusher',
      'single-arm-extension',
      'tricep-extension-machine',
      'overhead-machine-extension',
      'smith-overhead-extension',
      'trap-bar-overhead-extension',
      'trx-tricep-extension',
      'suspension-extension',
      'seated-tricep-machine'
    )
    or slug like 'overhead-tricep-extension%'
    or slug like 'single-arm-tricep-extension%'
    or slug like 'rope-overhead-extension%'
    or slug like 'cross-body-extension%'
  );
