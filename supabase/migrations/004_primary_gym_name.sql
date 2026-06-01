-- Named primary gym (e.g. "Planet Fitness") alongside home_gym / commercial_gym
alter table public.profiles
  add column if not exists primary_gym_name text;

comment on column public.profiles.primary_gym_name is 'User-facing gym name for workout prompts and session titles';
