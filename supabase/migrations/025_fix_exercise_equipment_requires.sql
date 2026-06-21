-- Align catalog metadata.requires with exercises.equipment for filtering.

update public.exercises
set metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{requires}', '["kettlebells"]'::jsonb)
where is_system = true and equipment = 'kettlebell';

update public.exercises
set metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{requires}', '["machines"]'::jsonb)
where is_system = true and equipment in ('cable', 'machine', 'rower');
