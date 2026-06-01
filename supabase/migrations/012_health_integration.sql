-- Sprint 7.4 — Apple Health integration: idempotent sync + health context

CREATE UNIQUE INDEX IF NOT EXISTS healthkit_sync_records_dedup_idx
  ON public.healthkit_sync_records (user_id, data_type, external_id)
  WHERE external_id IS NOT NULL;

-- Supabase upsert target (nullable external_id rows fall back to insert loop)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'healthkit_sync_records_user_type_external_unique'
  ) THEN
    ALTER TABLE public.healthkit_sync_records
      ADD CONSTRAINT healthkit_sync_records_user_type_external_unique
      UNIQUE (user_id, data_type, external_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS healthkit_sync_records_user_type_date_idx
  ON public.healthkit_sync_records (user_id, data_type, recorded_at DESC);

COMMENT ON INDEX healthkit_sync_records_dedup_idx IS 'Prevents duplicate HealthKit samples on re-sync';
