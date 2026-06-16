-- Weekly closeout archive — completed weeks are never overwritten.
create table if not exists public.weekly_closeouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_start_date date not null,
  week_end_date date not null,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'accepted', 'archived')),
  summary jsonb not null default '{}',
  next_week_plan jsonb not null default '{}',
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start_date)
);

create index if not exists weekly_closeouts_user_status_idx
  on public.weekly_closeouts (user_id, status, week_start_date desc);

alter table public.weekly_closeouts enable row level security;

create policy "Users manage own weekly closeouts"
  on public.weekly_closeouts for all
  using (auth.uid() = user_id);
