-- Multiple workout locations (gyms) per user
create table if not exists public.workout_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  location_type text not null check (location_type in ('home_gym', 'commercial_gym')),
  available_equipment text[] not null default '{}',
  is_default boolean not null default false,
  sort_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workout_locations_user on public.workout_locations(user_id, sort_order);

create unique index if not exists idx_workout_locations_one_default
  on public.workout_locations(user_id)
  where is_default = true;

alter table public.workout_locations enable row level security;

create policy "Users manage own workout locations"
  on public.workout_locations for all
  using (auth.uid() = user_id);

-- Backfill from legacy single primary_gym_name / training_location
insert into public.workout_locations (user_id, name, location_type, is_default, available_equipment, sort_order)
select
  p.id,
  coalesce(
    nullif(trim(p.primary_gym_name), ''),
    case p.training_location when 'home_gym' then 'Home Gym' when 'commercial_gym' then 'Commercial Gym' else 'My Gym' end
  ),
  coalesce(p.training_location, 'commercial_gym'),
  true,
  coalesce(p.available_equipment, '{}'),
  0
from public.profiles p
where (p.primary_gym_name is not null or p.training_location is not null)
  and not exists (select 1 from public.workout_locations wl where wl.user_id = p.id);
