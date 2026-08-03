# Regression guards

Fixes that broke in later perf/refactor passes. Each item has a static validator in `scripts/validate-critical-paths.mjs` where possible.

| Date | Area | Bug | Guard |
|------|------|-----|-------|
| 2026-06 | Settings | `Children` imported from `react-native` → crash | `SettingsGroup.tsx` must import `Children` from `'react'` |
| 2026-06 | Home | `onGenerateMealPlan` used but not destructured → crash | `HomeNextUpCard` prop patterns in validator |
| 2026-06 | Workout start | `useWorkoutPlanDraft` on Home outside provider → crash | `WorkoutPlanDraftProvider` in `AppProviders.tsx`, not nested in workout tab layout |
| 2026-06 | Smart replace | `sumMealMacros(results)` instead of `.macros` → NaN totals | `sumMealMacros(results.map((item) => item.macros))` in `SmartMealReplaceForm.tsx` |
| 2026-06 | Cancel workout | In-flight `refreshSession` restored cancelled session | `trackedSessionIdRef` + optimistic `clearLocalSessionState` in `WorkoutSessionContext.tsx` |
| 2026-06 | Progress photos | Public URLs fail silently on private bucket | `resolveProgressPhotos` + signed URLs in `bodyService.ts` |
| 2026-06 | Sign-in brand | Logo + wordmark side-by-side clipped text | Stack vertically in `AuthFormContainer` (`brandBlock`) |
| 2026-06 | Dashboard visuals | Workout hero photo removed with `WorkoutHeroCard` swap | `HomeNextUpCard` workout banner uses `HeroImages.dashboard.workout` |
| 2026-07 | Exercise logging | Bare `row` matched the cardio name pattern, so every barbell/cable/hammer row logged time and distance | `npm run validate:active-workout-progression`; app and backend `exerciseClassification.ts` must stay in sync |
| 2026-07 | Active workout | Swapped-in exercises took their set target from the logged set count, so the target climbed with every set and the exercise never completed | `npm run validate:active-workout-progression` — `alignPlanExercisesToSession` inherits the unclaimed plan slot, never `sets.length` |
| 2026-07 | Active workout | Re-applying a plan to a live session deleted exercises added mid-workout along with their logged sets | `applySessionExercisePlanInternal` skips any exercise with `sets.length > 0` |
| 2026-07 | Supersets | Back-to-back partner logs wrote both sets to the first exercise because `setCurrentIndex` had not re-rendered yet; Month 1 `ss-b` labels were also blank | `npm run validate:superset-logging` — `currentIndexRef` advances synchronously; letter group ids label as B1/B2 |

When fixing a user-facing flow, add a row here and a validator pattern if the bug can be caught statically.
