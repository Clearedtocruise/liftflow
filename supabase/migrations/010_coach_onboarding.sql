-- Sprint 5.2 — expanded gym profiles + coach onboarding metadata

alter table public.profiles drop constraint if exists profiles_training_location_check;
alter table public.profiles add constraint profiles_training_location_check
  check (training_location in (
    'home_gym',
    'garage_gym',
    'commercial_gym',
    'planet_fitness',
    'full_gym'
  ));

alter table public.workout_locations drop constraint if exists workout_locations_location_type_check;
alter table public.workout_locations add constraint workout_locations_location_type_check
  check (location_type in (
    'home_gym',
    'garage_gym',
    'commercial_gym',
    'planet_fitness',
    'full_gym'
  ));

comment on column public.profiles.metadata is
  'JSON: coachProfile (onboarding), coachActivation (system bootstrap), supplementRecommendations';
