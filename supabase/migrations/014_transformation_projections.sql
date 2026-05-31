-- Sprint 8.2 — Transformation Engine projection runs

create table if not exists public.transformation_projections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  before_photo_id uuid references public.progress_photos(id) on delete set null,
  current_photo_id uuid references public.progress_photos(id) on delete set null,
  target_body_fat_pct numeric(4,2) not null,
  current_weight_kg numeric(5,2),
  current_body_fat_pct numeric(4,2),
  current_lean_mass_kg numeric(5,2),
  current_fat_mass_kg numeric(5,2),
  projected_weight_kg numeric(5,2),
  projected_body_fat_pct numeric(4,2),
  projected_lean_mass_kg numeric(5,2),
  projected_fat_mass_kg numeric(5,2),
  projected_weeks_to_target numeric(5,1),
  success_score numeric(5,2),
  workout_adherence_pct numeric(5,2),
  nutrition_adherence_pct numeric(5,2),
  weight_trend text,
  rationale text,
  confidence text default 'medium',
  engine_version text not null default 'transformation-v1',
  created_at timestamptz not null default now()
);

create index if not exists idx_transformation_projections_user_created
  on public.transformation_projections(user_id, created_at desc);

alter table public.transformation_projections enable row level security;

create policy "Users manage own transformation projections"
  on public.transformation_projections
  for all
  using (auth.uid() = user_id);
