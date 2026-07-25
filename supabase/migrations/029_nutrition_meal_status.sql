-- Nutrition tracking correctness fixes.
--   1. Track planned vs. eaten meals explicitly instead of inferring from meal_plan_id.
--   2. Give meals a stable client-supplied key so de-duplication no longer relies on
--      (scheduled_date, meal_type), which treats two legitimate snacks as duplicates.
--   3. Let macros distinguish "not provided" from "legitimately zero".
--   4. De-duplicate grocery list items and make grocery lists reusable per week.
--   5. Add the missing RLS policy for nutrition_recommendations (RLS was enabled with
--      zero policies, making the table permanently unreadable).

-- 1/2/3: meals columns ------------------------------------------------------

alter table public.meals
  add column if not exists status text not null default 'planned',
  add column if not exists origin text not null default 'plan',
  add column if not exists consumed_at timestamptz,
  add column if not exists client_key text,
  add column if not exists macros_provided boolean not null default false;

alter table public.meals drop constraint if exists meals_status_check;
alter table public.meals
  add constraint meals_status_check check (status in ('planned', 'completed', 'skipped', 'modified'));

alter table public.meals drop constraint if exists meals_origin_check;
alter table public.meals
  add constraint meals_origin_check check (origin in ('plan', 'log'));

-- Backfill status/origin from the legacy JSON blob stored in instructions.
update public.meals
set status = case
      when instructions like '%"status":"completed"%' or instructions like '%"status": "completed"%' then 'completed'
      when instructions like '%"status":"skipped"%' or instructions like '%"status": "skipped"%' then 'skipped'
      when instructions like '%"status":"modified"%' or instructions like '%"status": "modified"%' then 'modified'
      else 'planned'
    end
where instructions is not null and instructions like '%"status"%';

-- Meals with no plan were previously treated as eaten by the client heuristic.
update public.meals set origin = 'log' where meal_plan_id is null;
update public.meals
set status = 'completed'
where origin = 'log' and status = 'planned';

update public.meals
set consumed_at = created_at
where consumed_at is null and status in ('completed', 'modified');

-- Existing rows carry whatever macros they were saved with; treat a non-null
-- calorie value as an explicit measurement so historical totals do not change.
update public.meals set macros_provided = true where calories is not null;

create index if not exists meals_user_scheduled_date_idx
  on public.meals (user_id, scheduled_date);

create unique index if not exists meals_user_client_key_idx
  on public.meals (user_id, client_key)
  where client_key is not null;

-- 4: grocery lists ----------------------------------------------------------

-- Collapse pre-existing duplicate items, keeping the checked state if any copy
-- was checked, before enforcing uniqueness.
update public.grocery_list_items gli
set is_checked = true
where gli.is_checked = false
  and exists (
    select 1
    from public.grocery_list_items other
    where other.grocery_list_id = gli.grocery_list_id
      and lower(trim(other.name)) = lower(trim(gli.name))
      and other.is_checked
  );

delete from public.grocery_list_items
where id in (
  select id from (
    select
      id,
      row_number() over (
        partition by grocery_list_id, lower(trim(name))
        order by sort_order, id
      ) as rn
    from public.grocery_list_items
  ) dupes
  where rn > 1
);

create unique index if not exists grocery_list_items_list_name_idx
  on public.grocery_list_items (grocery_list_id, lower(trim(name)));

-- Keep one list per user per week so regenerating a shopping list updates the
-- existing rows instead of accumulating write-only lists.
delete from public.grocery_lists
where id in (
  select id from (
    select
      id,
      row_number() over (
        partition by user_id, week_start_date
        order by created_at desc, id
      ) as rn
    from public.grocery_lists
    where week_start_date is not null
  ) dupes
  where rn > 1
);

create unique index if not exists grocery_lists_user_week_idx
  on public.grocery_lists (user_id, week_start_date)
  where week_start_date is not null;

-- 5: nutrition_recommendations RLS -----------------------------------------

alter table public.nutrition_recommendations enable row level security;

drop policy if exists "Users manage own nutrition recommendations" on public.nutrition_recommendations;
create policy "Users manage own nutrition recommendations"
  on public.nutrition_recommendations for all using (auth.uid() = user_id);
