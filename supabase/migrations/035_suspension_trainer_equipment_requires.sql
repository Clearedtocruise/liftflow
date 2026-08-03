-- Require a suspension trainer for TRX, gymnastic ring and suspension movements.
--
-- The bulk catalog import stored every one of these as equipment = 'bodyweight' with
-- requires = ['bodyweight']. Because bodyweight is granted at every training location, a TRX Row
-- passed the equipment filter for people who do not own a suspension trainer, and they were being
-- programmed exercises they had no way to perform.

update public.exercises
set metadata = jsonb_set(
  coalesce(metadata, '{}'::jsonb),
  '{requires}',
  '["suspension"]'::jsonb
)
where is_system = true
  and (
    lower(name) like 'trx %'
    or lower(name) like '% trx %'
    or lower(name) like 'ring %'
    or lower(name) like 'rings %'
    or lower(name) like 'suspension %'
    or lower(name) like '%gymnastic ring%'
    or slug like 'trx-%'
    or slug like 'ring-%'
    or slug like 'suspension-%'
  );
