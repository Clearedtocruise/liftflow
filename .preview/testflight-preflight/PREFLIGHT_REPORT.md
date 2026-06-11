# Pre-TestFlight Preflight Report

**Branch:** `rollback-stable`  
**Date:** 2026-06-11  
**Build target:** iOS TestFlight (EAS profile `testflight`)

---

## 1–7. Screenshots

**Status: BLOCKED — no iOS Simulator runtimes installed on this Mac.**

`xcrun simctl list runtimes` returns empty. Xcode is installed but no simulator images are available, so automated in-app screenshots cannot be captured from this environment.

### Screen → route mapping (capture on device/dev client)

| # | Requested | App route / how to open |
|---|-----------|-------------------------|
| 1 | Home screen | Tab **Home** → `/(tabs)/dashboard` |
| 2 | Workout launch flow | Tab **Workout** (no active session) → `StartWorkoutPrompt` |
| 3 | Today's Mission | Home → **Today's Workout** hero card (`WorkoutHeroCard`) or **Today's Insight** |
| 4 | Nutrition logging | Tab **Nutrition** → `/(tabs)/nutrition` |
| 5 | Activity feed | Tab **History** → `/(tabs)/history` |
| 6 | Goal progress | Tab **Progress** → `/(tabs)/progress` |
| 7 | Activity detail | History → tap session → `/session/[id]` **or** exercise card → `/(features)/exercise/[id]` |

### Partial visual assets (exercise card sprint)

Anatomy figure previews (not full-screen captures):

- `.preview/squat-front.svg.png`
- `.preview/pullup-back.svg.png`
- `.preview/bench-front.svg.png`

**iOS bundle export:** `npm run bundle:test` — **PASS** (Metro produced iOS bundle successfully).

---

## 8. Modified files list

### Modified (28)

```
backend/src/lib/coachActivation.ts
backend/src/lib/programEngine.ts
backend/src/lib/programSelection.ts
backend/src/lib/programTypes.ts
backend/src/lib/strava.ts
backend/src/routes/integrations.ts
package-lock.json
package.json
src/app/(features)/[feature].tsx
src/app/(features)/_layout.tsx
src/app/(features)/healthkit.tsx
src/app/(tabs)/_layout.tsx
src/app/(tabs)/dashboard.tsx
src/app/(tabs)/workout.tsx
src/app/_layout.tsx
src/app/session/[id].tsx
src/components/dashboard/WorkoutHeroCard.tsx
src/components/workout/StartWorkoutPrompt.tsx
src/components/workout/WorkoutCard.tsx
src/integrations/stravaProvider.ts
src/lib/db-mappers.ts
src/services/index.ts
src/services/integrationService.ts
src/services/notificationService.ts
src/services/workoutService.ts
src/state/AppProviders.tsx
src/state/workout/WorkoutSessionContext.tsx
src/types/training.ts
src/types/workout.ts
```

### New (sprint deliverables, excluding `.preview/` binaries)

```
scripts/render-exercise-figures.mjs
src/app/(features)/cardio-tracking.tsx
src/app/(features)/exercise/[id].tsx
src/components/cardio/CardioActivityPicker.tsx
src/components/cardio/CardioSessionPanel.tsx
src/components/exercise/ExerciseAnimationPanel.tsx
src/components/exercise/ExerciseHeroCard.tsx
src/components/exercise/ExerciseHistoryGraph.tsx
src/components/exercise/ExerciseLoggingPanel.tsx
src/components/exercise/ExerciseVisualPanel.tsx
src/components/exercise/anatomy/MuscleMapFigure.tsx
src/components/onboarding/NavigationIntroOverlay.tsx
src/components/workout/WorkoutElapsedTimer.tsx
src/components/workout/WorkoutSessionNotificationBridge.tsx
src/constants/cardioActivities.ts
src/constants/exerciseDatabase.ts
src/constants/muscles.ts
src/hooks/useExerciseStats.ts
src/lib/appForeground.ts
src/lib/exerciseCardResolver.ts
src/lib/firstRunFlags.ts
src/lib/stravaExport.ts
src/lib/workoutNotificationGuard.ts
src/services/exerciseStatsService.ts
src/services/initNotifications.ts
src/services/workoutSessionNotificationService.ts
src/types/exerciseCard.ts
```

---

## 9. TypeScript

**Status: FAIL**

```bash
./node_modules/.bin/tsc --noEmit
```

**65 errors** (pre-existing project-wide; not introduced solely by this sprint).

Notable errors in sprint-touched screens:

- `src/app/(tabs)/nutrition.tsx` — missing `useAuth` import
- `src/app/(tabs)/workout.tsx` — voice intent type mismatches, coach summary typing
- `src/app/(tabs)/progress.tsx` — `getTransformationHistory` missing on `IBodyService`

---

## 10. Expo Doctor

**Status: FAIL** (16/18 checks passed)

Failures:

1. **Duplicate native dependencies** — `expo-constants`, `expo-file-system` version duplication
2. **SDK version mismatches** — `expo-file-system`, `expo-linear-gradient`, `expo-notifications`, `expo-sharing`, `expo-speech` (expected SDK 54 pins vs installed 56.x); minor `react-native-svg` mismatch

```bash
npx expo-doctor
```

---

## Recommendation

Do **not** upload TestFlight until:

1. Simulator screenshots captured on device (items 1–7), **or** founder signs off without them
2. TypeScript errors triaged (at minimum fix `nutrition.tsx` `useAuth` import)
3. `npx expo install --check` run to align dependency versions before EAS build
