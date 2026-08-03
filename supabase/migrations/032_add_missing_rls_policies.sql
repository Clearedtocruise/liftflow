-- Add the row-level security policies that eight client-facing tables never had.
--
-- Each of these has RLS *enabled* with *zero* policies, which is not a partially open door — it is a
-- closed one. Postgres denies everything when a table has RLS on and no policy grants access, so the
-- app cannot read or write any of them. The backend is unaffected because the service-role key
-- bypasses RLS, which is why this has stayed invisible: every server-side path works, and only the
-- client silently gets nothing back.
--
-- The most consequential case is `healthkit_sync_records`. `healthService.sync` writes samples from
-- the device and `getDailySummaries` reads them back, both from the client, so Apple Health sync has
-- never actually stored anything in production. Confirmed against the live database: an insert as an
-- authenticated user returns
--   42501: new row violates row-level security policy for table "healthkit_sync_records"
-- and a select returns an empty array rather than an error, so every consumer treats "denied" as
-- "this user has no health data".
--
-- `performance_trends` has the same shape, which is why the home screen's coach insight reads
-- `workout_sets` directly instead: trends are unreadable from the client no matter what wrote them.
--
-- Six further tables are also RLS-enabled with no policies and are deliberately left closed, because
-- only the backend touches them: ad_impressions, beta_invites, beta_invite_redemptions,
-- exercise_cognition events (exercise_recognition_events), outcome_cohort_signals and
-- population_outcome_aggregates. Opening those would widen access rather than restore it.
--
-- Policy shape follows the tables that already work (`workout_sessions`, `planned_workouts`):
-- `for all using (auth.uid() = user_id)`. For an ALL policy Postgres applies `using` to the row check
-- on insert as well when no separate `with check` is given, so one clause covers read and write.

-- ---------------------------------------------------------------------------
-- Owned directly by a user_id column
-- ---------------------------------------------------------------------------

drop policy if exists "Users manage own health records" on public.healthkit_sync_records;
create policy "Users manage own health records" on public.healthkit_sync_records
  for all using (auth.uid() = user_id);

drop policy if exists "Users read own performance trends" on public.performance_trends;
create policy "Users read own performance trends" on public.performance_trends
  for all using (auth.uid() = user_id);

drop policy if exists "Users manage own watch sessions" on public.watch_sessions;
create policy "Users manage own watch sessions" on public.watch_sessions
  for all using (auth.uid() = user_id);

drop policy if exists "Users manage own motion samples" on public.motion_samples;
create policy "Users manage own motion samples" on public.motion_samples
  for all using (auth.uid() = user_id);

drop policy if exists "Users manage own rep count events" on public.rep_count_events;
create policy "Users manage own rep count events" on public.rep_count_events
  for all using (auth.uid() = user_id);

drop policy if exists "Users manage own photo comparisons" on public.photo_comparisons;
create policy "Users manage own photo comparisons" on public.photo_comparisons
  for all using (auth.uid() = user_id);

drop policy if exists "Users manage own physique projections" on public.physique_projections;
create policy "Users manage own physique projections" on public.physique_projections
  for all using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Owned through a parent row
-- ---------------------------------------------------------------------------
-- subscription_events has no user_id; ownership comes from the subscription it belongs to. Scoped
-- through that rather than left open, so one user cannot write events against another's subscription.

drop policy if exists "Users manage own subscription events" on public.subscription_events;
create policy "Users manage own subscription events" on public.subscription_events
  for all using (
    subscription_id in (select s.id from public.subscriptions s where s.user_id = auth.uid())
  );
