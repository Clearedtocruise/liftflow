-- Session start still opened on the second lift (Barbell Row) when the plan listed a plural or
-- alternate spelling of the first exercise ("Pull Ups", "Barbell Rows"). Two problems:
--   1. Matching was singular-exact, so "Pull Ups" (key "pull ups") never found catalog "Pull Up".
--   2. The loop advanced sort_order on every item, including unmatched/skipped ones, so a dropped
--      first exercise left a hole at sort_order 0 and the next lift became the session's index 0.
--
-- This recreates the seeding trigger to (a) match singular/plural and one-word compounds, and
-- (b) assign a CONTIGUOUS sort_order that only advances when a row is actually inserted, so the
-- first resolvable exercise is always at sort_order 0.

create or replace function public.seed_session_exercises_from_plan()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  plan_exercises jsonb;
  item jsonb;
  insert_idx integer := 0;
  exercise_name text;
  exercise_uuid uuid;
  name_key text;
  name_key_sing text;
  name_slug text;
  compact text;
begin
  if new.planned_workout_id is null then
    return new;
  end if;

  if exists (select 1 from public.workout_exercises we where we.session_id = new.id) then
    return new;
  end if;

  select coalesce(pw.metadata -> 'exercises', '[]'::jsonb)
  into plan_exercises
  from public.planned_workouts pw
  where pw.id = new.planned_workout_id;

  if plan_exercises is null or jsonb_typeof(plan_exercises) <> 'array' then
    return new;
  end if;

  for item in select value from jsonb_array_elements(plan_exercises) as t(value)
  loop
    exercise_name := nullif(trim(coalesce(item ->> 'name', item ->> 'exerciseName', '')), '');
    if exercise_name is null then
      continue;
    end if;

    name_key := trim(regexp_replace(lower(exercise_name), '[^a-z0-9]+', ' ', 'g'));
    -- Singular form of the key: drop a trailing 's' on the last word, but keep 'ss' (press, cross).
    name_key_sing := regexp_replace(name_key, '([a-z])s$', '\1');
    if right(name_key, 2) = 'ss' then
      name_key_sing := name_key;
    end if;
    name_slug := trim(both '-' from regexp_replace(lower(exercise_name), '[^a-z0-9]+', '-', 'g'));
    compact := regexp_replace(name_key, ' ', '', 'g');

    select e.id
    into exercise_uuid
    from public.exercises e
    where lower(e.name) = lower(exercise_name)
       or e.slug = name_slug
       or trim(regexp_replace(lower(e.name), '[^a-z0-9]+', ' ', 'g')) = name_key
       or trim(regexp_replace(lower(e.name), '[^a-z0-9]+', ' ', 'g')) = name_key_sing
       or regexp_replace(regexp_replace(lower(e.name), '[^a-z0-9]+', '', 'g'), 's$', '')
            = regexp_replace(compact, 's$', '')
    order by e.is_system desc nulls last, e.created_at asc nulls last
    limit 1;

    if exercise_uuid is not null then
      insert into public.workout_exercises (
        session_id,
        exercise_id,
        sort_order,
        suggested_reps,
        suggested_weight
      )
      values (
        new.id,
        exercise_uuid,
        insert_idx,
        nullif(item ->> 'reps', ''),
        case
          when nullif(item ->> 'weightLbs', '') is not null
            then (item ->> 'weightLbs')::numeric / 2.2046226218
          else null
        end
      )
      on conflict do nothing;

      -- Only advance the order when a row was actually inserted, so an unresolved exercise
      -- never leaves a gap that pushes the next lift into the first slot.
      insert_idx := insert_idx + 1;
    end if;
  end loop;

  return new;
end;
$function$;
