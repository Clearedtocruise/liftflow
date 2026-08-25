-- Basic subscription tier ($4.99/mo).
--
-- ONE MORE gains a Basic tier below Pro that unlocks custom day-based programs (1–30 days) with
-- automatic looping, workout/rest days, the exercise library, program editing, workout history,
-- persistent exercise performance, and the persistent/repeating nutrition plan. Pro is a superset.
--
-- The custom program cycle itself needs no new tables: the template lives in
-- training_programs.metadata.cycle (planPack = 'custom_cycle') and completed workouts stay in
-- workout_sessions, so history is already separate from the template.
--
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block, so this migration must be applied
-- on its own (Supabase applies each migration file separately).

alter type public.subscription_tier add value if not exists 'basic' before 'premium';
