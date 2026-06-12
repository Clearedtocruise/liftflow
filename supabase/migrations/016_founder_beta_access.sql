-- Build 156A — Founder & Beta Tester access flags (premium override, no RevenueCat change)

alter table public.profiles
  add column if not exists is_founder boolean not null default false,
  add column if not exists is_beta_tester boolean not null default false;

comment on column public.profiles.is_founder is 'Founder access — full premium without subscription';
comment on column public.profiles.is_beta_tester is 'Beta tester access — full premium without subscription';

create index if not exists idx_profiles_founder on public.profiles (is_founder) where is_founder = true;
create index if not exists idx_profiles_beta_tester on public.profiles (is_beta_tester) where is_beta_tester = true;
