-- Merge duplicate workout_exercises rows within a session, and stop new ones being created.
--
-- A session could hold the same exercise twice because two independent seeders write it: the
-- AFTER INSERT trigger `trg_seed_session_exercises_from_plan` on workout_sessions, and the client's
-- `preloadSessionExercises`. The trigger skips seeding when the client got there first; the client
-- had no matching check, so when the trigger won — which it does whenever a session is started from
-- a planned workout, because it runs inside that INSERT's own transaction — every exercise was
-- inserted a second time.
--
-- The user-visible damage is worse than a doubled list. Logging writes to whichever row the screen
-- is holding, so a set target of 4 was never reached on either copy, the exercise never completed,
-- and sets ended up split across both rows.
--
-- Sets are therefore merged onto one row rather than a duplicate being deleted: deleting a
-- duplicate that holds sets would destroy logged work, and workout_sets cascades on delete.

begin;

-- ---------------------------------------------------------------------------
-- 1. Choose one surviving row per (session, exercise)
-- ---------------------------------------------------------------------------

create temporary table _dedupe_plan on commit drop as
with ranked as (
  select
    we.id,
    we.session_id,
    we.exercise_id,
    we.sort_order,
    we.suggested_reps,
    we.suggested_weight,
    we.notes,
    we.block_id,
    row_number() over (
      partition by we.session_id, we.exercise_id
      order by we.sort_order, we.created_at, we.id
    ) as rn,
    first_value(we.id) over (
      partition by we.session_id, we.exercise_id
      order by we.sort_order, we.created_at, we.id
    ) as keep_id
  from public.workout_exercises we
  where we.exercise_id is not null
)
select id, session_id, exercise_id, keep_id, sort_order, suggested_reps, suggested_weight, notes, block_id
from ranked
where session_id in (
  select session_id
  from public.workout_exercises
  where exercise_id is not null
  group by session_id, exercise_id
  having count(*) > 1
);

-- ---------------------------------------------------------------------------
-- 2. Keep a record of what was changed, so this is reversible
-- ---------------------------------------------------------------------------

create table if not exists public._backup_030_dedupe_workout_exercises (
  backed_up_at timestamptz not null default now(),
  removed_id uuid not null,
  kept_id uuid not null,
  session_id uuid not null,
  exercise_id uuid not null,
  sort_order integer,
  suggested_reps text,
  suggested_weight numeric,
  notes text,
  block_id uuid,
  primary key (removed_id)
);

create table if not exists public._backup_030_dedupe_workout_sets (
  backed_up_at timestamptz not null default now(),
  set_id uuid not null,
  from_workout_exercise_id uuid not null,
  to_workout_exercise_id uuid not null,
  from_set_number integer,
  primary key (set_id)
);

insert into public._backup_030_dedupe_workout_exercises
  (removed_id, kept_id, session_id, exercise_id, sort_order, suggested_reps, suggested_weight, notes, block_id)
select p.id, p.keep_id, p.session_id, p.exercise_id, p.sort_order, p.suggested_reps, p.suggested_weight, p.notes, p.block_id
from _dedupe_plan p
where p.id <> p.keep_id
on conflict (removed_id) do nothing;

insert into public._backup_030_dedupe_workout_sets
  (set_id, from_workout_exercise_id, to_workout_exercise_id, from_set_number)
select ws.id, ws.workout_exercise_id, p.keep_id, ws.set_number
from public.workout_sets ws
join _dedupe_plan p on p.id = ws.workout_exercise_id
where p.id <> p.keep_id
on conflict (set_id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Carry plan detail across, so the surviving row is not the emptier one
-- ---------------------------------------------------------------------------

update public.workout_exercises keep
set suggested_reps = coalesce(keep.suggested_reps, donor.suggested_reps),
    suggested_weight = coalesce(keep.suggested_weight, donor.suggested_weight),
    notes = coalesce(keep.notes, donor.notes),
    block_id = coalesce(keep.block_id, donor.block_id)
from (
  select
    p.keep_id,
    min(p.suggested_reps) filter (where p.suggested_reps is not null) as suggested_reps,
    min(p.suggested_weight) filter (where p.suggested_weight is not null) as suggested_weight,
    min(p.notes) filter (where p.notes is not null) as notes,
    -- uuid has no min(), and any one of the duplicates' block ids will do.
    min(p.block_id::text) filter (where p.block_id is not null)::uuid as block_id
  from _dedupe_plan p
  where p.id <> p.keep_id
  group by p.keep_id
) donor
where keep.id = donor.keep_id;

-- ---------------------------------------------------------------------------
-- 4. Move the sets onto the surviving row
-- ---------------------------------------------------------------------------

update public.workout_sets ws
set workout_exercise_id = p.keep_id
from _dedupe_plan p
where ws.workout_exercise_id = p.id
  and p.id <> p.keep_id;

-- Set numbers collided: both copies started at 1. Renumber by when each set was actually logged so
-- the merged order matches what the lifter did.
with renumbered as (
  select
    ws.id,
    row_number() over (
      partition by ws.workout_exercise_id
      order by ws.logged_at, ws.id
    ) as new_number
  from public.workout_sets ws
  where ws.workout_exercise_id in (select distinct keep_id from _dedupe_plan)
)
update public.workout_sets ws
set set_number = r.new_number
from renumbered r
where ws.id = r.id
  and ws.set_number is distinct from r.new_number;

-- ---------------------------------------------------------------------------
-- 5. Drop the now-empty duplicates
-- ---------------------------------------------------------------------------

delete from public.workout_exercises we
using _dedupe_plan p
where we.id = p.id
  and p.id <> p.keep_id;

-- Deleting rows leaves holes in sort_order. Close them so the session list has no gaps and the
-- plan-alignment code, which pairs plan entries to session rows by position, lines up again.
with ordered as (
  select we.id, row_number() over (partition by we.session_id order by we.sort_order, we.created_at, we.id) - 1 as new_order
  from public.workout_exercises we
  where we.session_id in (select distinct session_id from _dedupe_plan)
)
update public.workout_exercises we
set sort_order = o.new_order
from ordered o
where we.id = o.id
  and we.sort_order is distinct from o.new_order;

-- ---------------------------------------------------------------------------
-- 6. Fold custom exercise rows onto the system row of the same name
-- ---------------------------------------------------------------------------
-- Migration 028 deduped the catalog and added a unique index over `lower(trim(name))`, but only
-- `where is_system = true`. A custom row can therefore still shadow a system exercise of the same
-- name, which is how "Reverse Fly" came to exist twice and how the same movement can resolve to two
-- different exercise_ids.

create temporary table _custom_name_remap on commit drop as
select custom.id as from_id, system_row.id as to_id
from public.exercises custom
join public.exercises system_row
  on system_row.is_system = true
 and lower(trim(system_row.name)) = lower(trim(custom.name))
where custom.is_system = false;

-- A user cannot hold the same exercise twice in user_custom_exercises, so drop the link that would
-- collide before remapping the rest.
delete from public.user_custom_exercises uce
using _custom_name_remap m
where uce.exercise_id = m.from_id
  and exists (
    select 1 from public.user_custom_exercises existing
    where existing.user_id = uce.user_id and existing.exercise_id = m.to_id
  );

update public.user_custom_exercises uce
set exercise_id = m.to_id
from _custom_name_remap m
where uce.exercise_id = m.from_id;

update public.workout_exercises we
set exercise_id = m.to_id
from _custom_name_remap m
where we.exercise_id = m.from_id;

update public.performance_trends pt
set exercise_id = m.to_id
from _custom_name_remap m
where pt.exercise_id = m.from_id;

update public.exercise_recognition_events ere
set suggested_exercise_id = m.to_id
from _custom_name_remap m
where ere.suggested_exercise_id = m.from_id;

delete from public.exercises e
using _custom_name_remap m
where e.id = m.from_id;

-- Remapping can itself create a duplicate pair in a session, so merge once more over the rows the
-- remap touched. Same rule as above: sets move, the emptied row goes.
create temporary table _dedupe_plan_2 on commit drop as
with ranked as (
  select
    we.id,
    we.session_id,
    row_number() over (partition by we.session_id, we.exercise_id order by we.sort_order, we.created_at, we.id) as rn,
    first_value(we.id) over (partition by we.session_id, we.exercise_id order by we.sort_order, we.created_at, we.id) as keep_id
  from public.workout_exercises we
  where we.exercise_id is not null
)
select id, session_id, keep_id from ranked where id <> keep_id;

update public.workout_sets ws
set workout_exercise_id = p.keep_id
from _dedupe_plan_2 p
where ws.workout_exercise_id = p.id;

with renumbered as (
  select ws.id, row_number() over (partition by ws.workout_exercise_id order by ws.logged_at, ws.id) as new_number
  from public.workout_sets ws
  where ws.workout_exercise_id in (select distinct keep_id from _dedupe_plan_2)
)
update public.workout_sets ws
set set_number = r.new_number
from renumbered r
where ws.id = r.id and ws.set_number is distinct from r.new_number;

delete from public.workout_exercises we using _dedupe_plan_2 p where we.id = p.id;

with ordered as (
  select we.id, row_number() over (partition by we.session_id order by we.sort_order, we.created_at, we.id) - 1 as new_order
  from public.workout_exercises we
  where we.session_id in (select distinct session_id from _dedupe_plan_2)
)
update public.workout_exercises we
set sort_order = o.new_order
from ordered o
where we.id = o.id and we.sort_order is distinct from o.new_order;

-- ---------------------------------------------------------------------------
-- 7. Repair the two things the same mess left behind elsewhere
-- ---------------------------------------------------------------------------
-- Sessions can also carry holes in sort_order from the previous behaviour of
-- `applySessionExercisePlan`, which deleted exercises the plan did not name without closing the gap.
-- Positional code — `alignPlanExercisesToSession`, the superset and circuit station indices — reads
-- sort_order as a dense sequence, so a hole silently shifts every later exercise.
with ordered as (
  select we.id, row_number() over (partition by we.session_id order by we.sort_order, we.created_at, we.id) - 1 as new_order
  from public.workout_exercises we
  where we.session_id in (
    select session_id from public.workout_exercises group by session_id having max(sort_order) <> count(*) - 1
  )
)
update public.workout_exercises we
set sort_order = o.new_order
from ordered o
where we.id = o.id
  and we.sort_order is distinct from o.new_order;

-- Two sets on one exercise can share a set_number when the next number was derived from a stale
-- count. The summary screen labels sets by that number, so a collision renders as the same set twice.
with renumbered as (
  select ws.id, row_number() over (partition by ws.workout_exercise_id order by ws.logged_at, ws.id) as new_number
  from public.workout_sets ws
  where ws.workout_exercise_id in (
    select workout_exercise_id from public.workout_sets group by workout_exercise_id, set_number having count(*) > 1
  )
)
update public.workout_sets ws
set set_number = r.new_number
from renumbered r
where ws.id = r.id
  and ws.set_number is distinct from r.new_number;

-- ---------------------------------------------------------------------------
-- 8. Stop it happening again
-- ---------------------------------------------------------------------------
-- The app already assumes one row per exercise per session: `applySessionExercisePlan` matches plan
-- entries to session rows by exercise, and `alignPlanExercisesToSession` claims each row once. The
-- assumption was never enforced, so any writer that forgot to check could double the list. A
-- duplicate insert now fails instead, which leaves the row that is already there.
create unique index if not exists workout_exercises_session_exercise_unique_idx
  on public.workout_exercises (session_id, exercise_id)
  where exercise_id is not null;

-- Widen 028's guard so a custom row cannot shadow a system exercise by name either.
create unique index if not exists exercises_unique_name_idx
  on public.exercises (lower(trim(name)));

commit;
