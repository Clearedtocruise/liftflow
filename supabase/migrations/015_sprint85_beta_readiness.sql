-- Sprint 8.5 — Beta User Readiness Pack

create type public.feedback_type as enum ('bug', 'feature', 'support');
create type public.feedback_status as enum ('open', 'triaged', 'resolved', 'closed');

create table if not exists public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  feedback_type public.feedback_type not null,
  subject text not null,
  body text not null,
  screenshot_url text,
  device_metadata jsonb not null default '{}',
  app_version text,
  app_environment text,
  status public.feedback_status not null default 'open',
  founder_notified boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  session_id text,
  event_name text not null,
  properties jsonb not null default '{}',
  app_version text,
  app_environment text,
  platform text,
  created_at timestamptz not null default now()
);

create table if not exists public.beta_invites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text,
  max_uses int not null default 1,
  uses_count int not null default 0,
  is_internal boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.beta_invite_redemptions (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.beta_invites(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  unique (invite_id, user_id)
);

create table if not exists public.release_notes (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  title text not null,
  body text not null,
  is_published boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.changelog_entries (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  category text not null default 'improvement',
  summary text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists is_internal_tester boolean not null default false,
  add column if not exists beta_tester_tag text,
  add column if not exists beta_invite_code text;

create index if not exists idx_beta_feedback_created on public.beta_feedback(created_at desc);
create index if not exists idx_beta_feedback_status on public.beta_feedback(status, created_at desc);
create index if not exists idx_app_events_name_created on public.app_events(event_name, created_at desc);
create index if not exists idx_app_events_user_created on public.app_events(user_id, created_at desc);
create index if not exists idx_beta_invites_code on public.beta_invites(code);

alter table public.beta_feedback enable row level security;
alter table public.app_events enable row level security;
alter table public.beta_invites enable row level security;
alter table public.beta_invite_redemptions enable row level security;
alter table public.release_notes enable row level security;
alter table public.changelog_entries enable row level security;

create policy "Users insert own feedback" on public.beta_feedback for insert with check (auth.uid() = user_id);
create policy "Users read own feedback" on public.beta_feedback for select using (auth.uid() = user_id);
create policy "Users insert own events" on public.app_events for insert with check (auth.uid() = user_id);
create policy "Users read own events" on public.app_events for select using (auth.uid() = user_id);
create policy "Anyone read published release notes" on public.release_notes for select using (is_published = true);
create policy "Anyone read changelog" on public.changelog_entries for select using (true);
