-- Sprint 2: AI Coach Foundation

-- Extend daily recovery check-ins
alter table public.recovery_assessments
  add column if not exists check_in_date date,
  add column if not exists sleep_quality_score integer check (sleep_quality_score between 1 and 10),
  add column if not exists stress_score integer check (stress_score between 1 and 10),
  add column if not exists recovery_score integer check (recovery_score between 0 and 100),
  add column if not exists daily_recommendation text,
  add column if not exists recovery_mode_active boolean default false;

create unique index if not exists idx_recovery_check_in_daily
  on public.recovery_assessments(user_id, check_in_date)
  where check_in_date is not null;

alter table public.recovery_assessments
  drop constraint if exists recovery_assessments_user_check_in_date_key;

alter table public.recovery_assessments
  add constraint recovery_assessments_user_check_in_date_key unique (user_id, check_in_date);

-- Weekly AI coach check-ins
create table if not exists public.weekly_coach_check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_start_date date not null,
  weight_kg numeric(5,2),
  waist_cm numeric(5,2),
  compliance_pct numeric(5,2),
  energy_score integer check (energy_score between 1 and 10),
  sleep_score integer check (sleep_score between 1 and 10),
  analysis text,
  recommendations jsonb default '[]',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique(user_id, week_start_date)
);

-- Injuries and limitations
do $$ begin
  create type public.limitation_type as enum ('injury', 'pain', 'tightness', 'mobility', 'discomfort');
exception when duplicate_object then null;
end $$;

create table if not exists public.training_limitations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  limitation_type public.limitation_type not null,
  body_area text not null,
  severity integer check (severity between 1 and 10),
  pain_score integer check (pain_score between 0 and 10),
  is_diagnosed boolean default false,
  description text,
  movement_restrictions text[] default '{}',
  affected_movements text[] default '{}',
  is_active boolean default true,
  resolved_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_weekly_check_ins_user on public.weekly_coach_check_ins(user_id, week_start_date desc);
create index if not exists idx_training_limitations_user on public.training_limitations(user_id, is_active);

alter table public.weekly_coach_check_ins enable row level security;
alter table public.training_limitations enable row level security;

create policy "Users manage own weekly check-ins" on public.weekly_coach_check_ins for all using (auth.uid() = user_id);
create policy "Users manage own limitations" on public.training_limitations for all using (auth.uid() = user_id);
