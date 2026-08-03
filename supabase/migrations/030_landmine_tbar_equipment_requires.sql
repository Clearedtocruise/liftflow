-- Require a landmine / T-bar station for landmine and T-bar movements.
-- A plain barbell + rack is not enough — these need a landmine attachment or T-bar.

update public.exercises
set metadata = jsonb_set(
  coalesce(metadata, '{}'::jsonb),
  '{requires}',
  '["landmine"]'::jsonb
)
where is_system = true
  and (
    slug = 't-bar-row'
    or slug like 't-bar-row-%'
    or slug like 'landmine-%'
    or lower(name) like '%t-bar row%'
    or lower(name) like '%t bar row%'
    or lower(name) like 'landmine %'
  );
