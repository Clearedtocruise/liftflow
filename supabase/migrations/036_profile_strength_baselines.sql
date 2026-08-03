-- Compound lifts the athlete reports at onboarding, used to seed starting loads.
--
-- Without these the planner guessed a first working weight as a fixed fraction of bodyweight —
-- squat at 65%, bench at 45% — which is the same number for a decade-long lifter and a beginner of
-- equal weight, and is what produced implausible starting loads.
--
-- Stored as the set that was reported rather than a max, so the estimate can be recalculated if the
-- formula changes and nothing claims the athlete tested a true single. Shape:
--   {"bench_press": {"weightLbs": 185, "reps": 5}, "squat": {...}, "deadlift": {...}}

alter table public.profiles
  add column if not exists strength_baselines jsonb not null default '{}'::jsonb;

comment on column public.profiles.strength_baselines is
  'Reported compound lift sets (weightLbs + reps) used to seed starting loads before any history exists.';
