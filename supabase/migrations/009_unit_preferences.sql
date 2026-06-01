-- Sprint 3.9: granular unit display preferences (internal storage stays metric)

alter table public.profiles
  add column if not exists preferred_height_unit text not null default 'ft_in'
    check (preferred_height_unit in ('ft_in', 'in', 'cm')),
  add column if not exists preferred_weight_unit text not null default 'lb'
    check (preferred_weight_unit in ('lb', 'kg')),
  add column if not exists preferred_distance_unit text not null default 'mi'
    check (preferred_distance_unit in ('mi', 'km')),
  add column if not exists preferred_measurement_unit text not null default 'in'
    check (preferred_measurement_unit in ('in', 'cm')),
  add column if not exists preferred_water_unit text not null default 'oz'
    check (preferred_water_unit in ('oz', 'L'));

-- Backfill from legacy preferred_units
update public.profiles
set
  preferred_height_unit = 'cm',
  preferred_weight_unit = 'kg',
  preferred_distance_unit = 'km',
  preferred_measurement_unit = 'cm',
  preferred_water_unit = 'L'
where preferred_units = 'metric';
