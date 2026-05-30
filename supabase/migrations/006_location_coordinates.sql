-- GPS coordinates for geofenced gym detection
alter table public.workout_locations
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists radius_meters integer not null default 150;

comment on column public.workout_locations.latitude is 'WGS84 latitude when user saves gym on-site';
comment on column public.workout_locations.longitude is 'WGS84 longitude when user saves gym on-site';
comment on column public.workout_locations.radius_meters is 'Geofence radius for arrival detection';
