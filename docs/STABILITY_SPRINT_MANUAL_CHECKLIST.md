# Stability UX Sprint — Manual checklist

Use on a device build after automated regressions pass.

## Workout engine
- [ ] Traditional lift: Set 1 → Set 2 → Set 3 on the same exercise before advancing
- [ ] Completing one exercise does not finish the whole workout
- [ ] Finish only when all exercises are done (or user taps Finish)
- [ ] Completed day shows as completed workout, not Rest Day
- [ ] Add Exercise inserts after the current move; index/sets/timer stay intact
- [ ] Create custom exercise from picker; it appears in search and logs correctly

## Watch + timer + calories
- [ ] Start lift on phone → Watch presents workout UI when reachable (cold launch may require opening Watch app — see `WATCH_NATIVE.md`)
- [ ] Pause then resume: elapsed clock does not jump by pause duration
- [ ] Watch shows live **Active cal** climbing with HR during strength
- [ ] Strength History shows Active cal after end
- [ ] Morning Outdoor Run appears once in History with distance/Active cal near Apple Fitness (no second weak Steady Run chalk)

## Nutrition + Home
- [ ] Meal replace: entrée + Add side; one card; macros match Calculate Macros confirm total
- [ ] Home order: Nutrition → Workout → Plan Adjusted at bottom
- [ ] Plan Adjusted not on Workout or Meals tabs
- [ ] Home / Nutrition show **Calories left** (and protein left) aligned with goals
- [ ] Home shows active burned today; post-lift volume after strength complete
- [ ] Check-in cue only once per day

## Voice
- [ ] Settings → Test voice logging: mic meter, practice phrases, diagnostics, calibration list

## Ship
- [ ] Apply Supabase migration `031_exercise_cleanup_and_session_calories.sql` if not already
- [ ] Redeploy backend (plan rules / frequency repair)
- [ ] TestFlight build installed and spot-checked above
