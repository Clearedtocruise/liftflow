-- Expand core exercise catalog — flexion, rotation, anti-extension, and bodyweight staples.

insert into public.exercises (name, slug, category, equipment, muscle_groups, is_system, exercise_type, metadata) values
  ('Crunch', 'crunch', 'core', 'bodyweight', array['core'], true, 'strength',
    '{"requires":["bodyweight"],"movement_family":"core_flexion"}'::jsonb),
  ('Sit-Up', 'sit-up', 'core', 'bodyweight', array['core'], true, 'strength',
    '{"requires":["bodyweight"],"movement_family":"core_flexion"}'::jsonb),
  ('Reverse Crunch', 'reverse-crunch', 'core', 'bodyweight', array['core'], true, 'strength',
    '{"requires":["bodyweight"],"movement_family":"core_flexion"}'::jsonb),
  ('Bicycle Crunch', 'bicycle-crunch', 'core', 'bodyweight', array['core', 'obliques'], true, 'strength',
    '{"requires":["bodyweight"],"movement_family":"core_rotation"}'::jsonb),
  ('Cable Crunch', 'cable-crunch', 'core', 'cable', array['core'], true, 'strength',
    '{"requires":["machines"],"movement_family":"core_flexion"}'::jsonb),
  ('Dead Bug', 'dead-bug', 'core', 'bodyweight', array['core'], true, 'strength',
    '{"requires":["bodyweight"],"movement_family":"core_anti_extension"}'::jsonb),
  ('Hollow Hold', 'hollow-hold', 'core', 'bodyweight', array['core'], true, 'timed',
    '{"requires":["bodyweight"],"movement_family":"core_anti_extension"}'::jsonb),
  ('Russian Twist', 'russian-twist', 'core', 'bodyweight', array['core', 'obliques'], true, 'strength',
    '{"requires":["bodyweight"],"movement_family":"core_rotation"}'::jsonb)
on conflict (slug) do nothing;
