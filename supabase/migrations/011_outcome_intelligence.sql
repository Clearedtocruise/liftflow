-- Sprint 6.0 Phase 1 — Outcome Intelligence Foundation
-- Measure outcomes, not activity.

-- ---------------------------------------------------------------------------
-- Extend goals with achievement tracking
-- ---------------------------------------------------------------------------
alter table public.goals
  add column if not exists completion_pct numeric(5,2) default 0 check (completion_pct >= 0 and completion_pct <= 100),
  add column if not exists projected_completion_date date,
  add column if not exists velocity numeric(12,4),
  add column if not exists baseline_value numeric(12,2);

comment on column public.goals.completion_pct is 'Progress toward target_value as percentage 0–100';
comment on column public.goals.projected_completion_date is 'Estimated completion date from current velocity';
comment on column public.goals.velocity is 'Units of progress per week toward goal';
comment on column public.goals.baseline_value is 'Starting value when goal was created';

-- ---------------------------------------------------------------------------
-- User outcome baseline (captured at coach activation)
-- ---------------------------------------------------------------------------
create table if not exists public.user_outcome_baselines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade unique,
  starting_weight_kg numeric(6,2),
  starting_body_fat_pct numeric(4,2),
  starting_measurements jsonb not null default '{}',
  starting_strength_metrics jsonb not null default '{}',
  starting_recovery_score numeric(5,2),
  onboarding_date date not null default current_date,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Periodic outcome snapshots with deltas
-- ---------------------------------------------------------------------------
create table if not exists public.user_outcome_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  snapshot_date date not null,
  period_type text not null default 'weekly' check (period_type in ('daily', 'weekly')),
  current_weight_kg numeric(6,2),
  current_body_fat_pct numeric(4,2),
  current_measurements jsonb not null default '{}',
  current_strength_metrics jsonb not null default '{}',
  current_recovery_score numeric(5,2),
  weight_delta_kg numeric(6,2),
  body_fat_delta_pct numeric(4,2),
  strength_delta jsonb not null default '{}',
  recovery_delta numeric(5,2),
  workout_adherence_pct numeric(5,2),
  nutrition_adherence_pct numeric(5,2),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique(user_id, snapshot_date, period_type)
);

-- ---------------------------------------------------------------------------
-- Composite success scores
-- ---------------------------------------------------------------------------
create table if not exists public.user_success_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  computed_at date not null default current_date,
  overall_score numeric(5,2) not null check (overall_score >= 0 and overall_score <= 100),
  workout_adherence_score numeric(5,2),
  nutrition_adherence_score numeric(5,2),
  recovery_compliance_score numeric(5,2),
  goal_progress_score numeric(5,2),
  strength_progress_score numeric(5,2),
  weight_progress_score numeric(5,2),
  score_category text not null check (score_category in ('exceptional', 'good', 'needs_attention', 'at_risk')),
  life_improved boolean not null default false,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique(user_id, computed_at)
);

-- ---------------------------------------------------------------------------
-- At-risk flags and coaching interventions
-- ---------------------------------------------------------------------------
create table if not exists public.user_risk_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  risk_level text not null check (risk_level in ('low', 'moderate', 'at_risk', 'critical')),
  risk_reason text not null,
  generated_coaching_message text,
  is_active boolean not null default true,
  resolved_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_user_risk_flags_active
  on public.user_risk_flags(user_id, is_active, created_at desc);

-- ---------------------------------------------------------------------------
-- Anonymous population aggregates (founder / company metrics)
-- ---------------------------------------------------------------------------
create table if not exists public.population_outcome_aggregates (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null unique,
  total_users integer not null default 0,
  active_users_30d integer not null default 0,
  paying_users integer not null default 0,
  total_pounds_lost numeric(12,2) not null default 0,
  total_pounds_gained_muscle numeric(12,2) not null default 0,
  total_workouts_completed integer not null default 0,
  total_hours_trained numeric(12,2) not null default 0,
  avg_weight_loss_kg numeric(8,3),
  avg_strength_increase_pct numeric(8,3),
  avg_recovery_improvement numeric(8,3),
  avg_goal_completion_pct numeric(5,2),
  avg_workout_adherence_pct numeric(5,2),
  avg_nutrition_adherence_pct numeric(5,2),
  avg_success_score numeric(5,2),
  lives_improved_count integer not null default 0,
  retention_rate_30d numeric(5,2),
  goal_success_rates jsonb not null default '{}',
  goal_failure_rates jsonb not null default '{}',
  success_behavior_signals jsonb not null default '{}',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- AI learning foundation — cohort behavior snapshots (no ML yet)
-- ---------------------------------------------------------------------------
create table if not exists public.outcome_cohort_signals (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  cohort_type text not null check (cohort_type in ('successful', 'unsuccessful', 'at_risk', 'all')),
  sample_size integer not null default 0,
  avg_training_days_per_week numeric(4,2),
  avg_protein_compliance_pct numeric(5,2),
  avg_sleep_hours numeric(4,2),
  avg_workout_adherence_pct numeric(5,2),
  avg_success_score numeric(5,2),
  behavior_patterns jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique(snapshot_date, cohort_type)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_outcome_snapshots_user_date
  on public.user_outcome_snapshots(user_id, snapshot_date desc);

create index if not exists idx_success_scores_user_date
  on public.user_success_scores(user_id, computed_at desc);

create index if not exists idx_outcome_baselines_onboarding
  on public.user_outcome_baselines(onboarding_date);

-- ---------------------------------------------------------------------------
-- RLS — user-owned tables; aggregates are service-role only
-- ---------------------------------------------------------------------------
alter table public.user_outcome_baselines enable row level security;
alter table public.user_outcome_snapshots enable row level security;
alter table public.user_success_scores enable row level security;
alter table public.user_risk_flags enable row level security;
alter table public.population_outcome_aggregates enable row level security;
alter table public.outcome_cohort_signals enable row level security;

create policy "Users read own outcome baseline"
  on public.user_outcome_baselines for select using (auth.uid() = user_id);

create policy "Users read own outcome snapshots"
  on public.user_outcome_snapshots for select using (auth.uid() = user_id);

create policy "Users read own success scores"
  on public.user_success_scores for select using (auth.uid() = user_id);

create policy "Users read own risk flags"
  on public.user_risk_flags for select using (auth.uid() = user_id);

-- Service role (backend) bypasses RLS for writes and founder reads
