-- Founder/beta Pro override: beta tester flag only (founder uses email in client)

alter table public.profiles
  add column if not exists is_beta_tester boolean not null default false;
