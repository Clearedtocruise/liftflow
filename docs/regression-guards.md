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

When fixing a user-facing flow, add a row here and a validator pattern if the bug can be caught statically.
