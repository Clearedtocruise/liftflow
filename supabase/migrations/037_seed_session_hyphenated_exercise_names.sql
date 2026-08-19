-- Session start skipped hyphenated plan names (Pull-Up, Chin-Up, Step-Up) because the
-- catalog stores them spaced (Pull Up) with slug pull-up. Exact lower(name) missed, the
-- client then failed to insert a duplicate slug, and the workout opened on the next lift
-- with no sets logged.

create or replace function public.seed_session_exercises_from_plan()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  plan_exercises jsonb;
  item jsonb;
  idx integer := 0;
  exercise_name text;
  exercise_uuid uuid;
  name_key text;
  name_slug text;
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
      idx := idx + 1;
      continue;
    end if;

    name_key := trim(regexp_replace(lower(exercise_name), '[^a-z0-9]+', ' ', 'g'));
    name_slug := trim(both '-' from regexp_replace(lower(exercise_name), '[^a-z0-9]+', '-', 'g'));

    select e.id
    into exercise_uuid
    from public.exercises e
    where lower(e.name) = lower(exercise_name)
       or e.slug = name_slug
       or trim(regexp_replace(lower(e.name), '[^a-z0-9]+', ' ', 'g')) = name_key
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
        idx,
        nullif(item ->> 'reps', ''),
        case
          when nullif(item ->> 'weightLbs', '') is not null
            then (item ->> 'weightLbs')::numeric / 2.2046226218
          else null
        end
      )
      on conflict do nothing;
    end if;

    idx := idx + 1;
  end loop;

  return new;
end;
$function$;
