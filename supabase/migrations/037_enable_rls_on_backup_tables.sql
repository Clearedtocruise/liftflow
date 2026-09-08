-- Close the Supabase Security Advisor finding `rls_disabled_in_public`.
--
-- Migration 030 left two public backup tables without row-level security. Tables in
-- `public` are exposed through the Data API, so with RLS off anyone holding the
-- project URL + anon key can read/write/delete every row.
--
-- These tables are migration forensics only — the app never queries them. Enabling
-- RLS with no policies denies all anon/authenticated access. The service-role key
-- used by the backend still bypasses RLS if we ever need to inspect the backups.

alter table public._backup_030_dedupe_workout_exercises enable row level security;
alter table public._backup_030_dedupe_workout_sets enable row level security;

-- Defense in depth: revoke direct table privileges from API roles. RLS already
-- denies rows, but an explicit revoke keeps the tables out of the OpenAPI surface
-- surface for anon/authenticated clients.
revoke all on table public._backup_030_dedupe_workout_exercises from anon, authenticated;
revoke all on table public._backup_030_dedupe_workout_sets from anon, authenticated;
