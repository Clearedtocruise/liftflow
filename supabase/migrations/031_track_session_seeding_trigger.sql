-- Bring the session-seeding trigger into version control.
--
-- `seed_session_exercises_from_plan` and `trg_seed_session_exercises_from_plan` already exist in the
-- production database but appear in no migration, so a fresh project or a reset would come up
-- without them and nothing in the repo said they were there. That invisibility is how a session
-- ended up seeded twice: the client's `preloadSessionExercises` was written as though it were the
-- only seeder.
--
-- This migration is the definition as it stands in production, unchanged, plus the gap it leaves:
-- the trigger drops any plan entry whose name is not already in `exercises`, because it will not
-- create a catalog row from inside the insert. The client fills that gap after the trigger has run.
--
-- Both halves of the arrangement matter:
--   * The trigger skips entirely when `workout_exercises` already holds rows for the session, so a
--     client that seeded first wins.
--   * The client skips exercise ids the session already holds, so the trigger having seeded first
--     no longer produces a second copy of everything.
-- Migration 030 also adds a unique index on (session_id, exercise_id), which enforces the invariant
-- rather than relying on both sides remembering to check.

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
begin
  if new.planned_workout_id is null then
    return new;
  end if;

  -- Skip if exercises were already applied by the client
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

    select e.id
    into exercise_uuid
    from public.exercises e
    where lower(e.name) = lower(exercise_name)
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
      -- 030 made (session_id, exercise_id) unique. A plan that names the same exercise twice must
      -- seed it once rather than abort the session insert this trigger is attached to.
      on conflict do nothing;
    end if;

    idx := idx + 1;
  end loop;

  return new;
end;
$function$;

drop trigger if exists trg_seed_session_exercises_from_plan on public.workout_sessions;
create trigger trg_seed_session_exercises_from_plan
  after insert on public.workout_sessions
  for each row
  when (new.planned_workout_id is not null and new.status in ('active', 'paused'))
  execute function public.seed_session_exercises_from_plan();
