-- Beta tester + founder premium bypass flags

alter table public.profiles
  add column if not exists is_beta_tester boolean not null default false,
  add column if not exists is_founder boolean not null default false;

-- Existing internal testers and invite redeemers become beta testers
update public.profiles
set is_beta_tester = true
where is_internal_tester = true
   or beta_tester_tag is not null;

-- Founder account(s) — update email list as needed
update public.profiles
set is_founder = true,
    is_beta_tester = true
where lower(email) in ('clearedtocruise@gmail.com');

create index if not exists idx_profiles_beta_tester on public.profiles(is_beta_tester) where is_beta_tester = true;
create index if not exists idx_profiles_founder on public.profiles(is_founder) where is_founder = true;
