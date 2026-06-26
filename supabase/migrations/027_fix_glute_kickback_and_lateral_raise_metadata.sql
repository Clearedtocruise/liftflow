-- Glute kickback rows were mis-tagged as triceps (push-day eligible). Restore glute isolation metadata.
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
    'education_corrected_at', '2026-06-25',
    'education_version', 2
  ),
  updated_at = now()
where slug like 'glute-kickback%' and is_system = true;

-- Lateral raise should isolate shoulders, not register as full-body/general press.
update public.exercises
set
  category = 'push'::movement_category,
  muscle_groups = array['shoulders'],
  secondary_muscles = array['traps'],
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'movement_family', 'rear_delt',
    'requires', case
      when equipment = 'dumbbell' then '["dumbbells"]'::jsonb
      when equipment = 'bodyweight' then '["bodyweight"]'::jsonb
      when equipment = 'barbell' then '["barbell", "rack"]'::jsonb
      when equipment = 'machine' or equipment = 'cable' then '["machines"]'::jsonb
      else coalesce(metadata->'requires', '[]'::jsonb)
    end,
    'education_corrected_at', '2026-06-25',
    'education_version', 2
  ),
  updated_at = now()
where slug like 'lateral-raise%' and is_system = true;
