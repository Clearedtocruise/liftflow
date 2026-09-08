-- Cleared to Cruise (wyflyyfrkobfoavmhsem) — Security Advisor lockdown
-- Applied live 2026-08-04. Kept here because that project's repo is private to this agent.
--
-- Closes:
--   - rls_disabled_in_public on email_logs, site_settings, waiver_audit_log
--   - sensitive_columns_exposed (recipientEmail / signerEmail / owner signature in settings)
-- Also drops the accidental "TEMP public update bookings" policy (qual = true).

alter table public.email_logs enable row level security;
alter table public.site_settings enable row level security;
alter table public.waiver_audit_log enable row level security;

revoke all on table public.email_logs from anon, authenticated;
revoke all on table public.site_settings from anon, authenticated;
revoke all on table public.waiver_audit_log from anon, authenticated;

drop policy if exists "TEMP public update bookings" on public.bookings;
