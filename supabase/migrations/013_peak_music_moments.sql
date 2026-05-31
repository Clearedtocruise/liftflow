-- Sprint 7.X — Peak music moments (optional cloud sync; app uses AsyncStorage first)
create table if not exists public.peak_music_moments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('apple_music', 'spotify', 'amazon_music', 'pandora', 'local')),
  track_id text not null,
  track_name text not null,
  artist_name text,
  peak_offset_ms integer not null check (peak_offset_ms >= 0),
  label text,
  storage text not null default 'local_only' check (storage in ('provider_sync', 'local_only', 'hybrid')),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, track_id)
);

create index if not exists idx_peak_music_moments_user on public.peak_music_moments(user_id);

alter table public.peak_music_moments enable row level security;

create policy "Users manage own peak moments"
  on public.peak_music_moments for all
  using (auth.uid() = user_id);
