# Emergency Root Cause Investigation

**Branch:** `diagnostic/boot-test`  
**Date:** 2026-06-11  
**Status:** Boot test build pending device verification

---

## Why rollback did NOT fix crashes

Rollback to git commit `8417355` did **not** rollback what TestFlight actually shipped for builds **150–163**.

| Fact | Evidence |
|------|----------|
| EAS archives include **uncommitted + untracked files** | Builds 150–163 used commit `8417355` but were built from a **dirty working tree** |
| Voice refactor files were **never committed** | `WorkoutVoiceControlsLive`, `NutritionVoiceMicActive`, `useVoiceRecognitionLive`, `speechRecognitionService` existed only as local untracked files |
| Git rollback ≠ binary rollback | Resetting git does not remove untracked files from the EAS upload tarball |
| Build 168 was first clean stabilization commit | Added `.easignore` to exclude experimental untracked paths |

**Conclusion:** “Rollback” restored git history but TestFlight builds **150–163 still contained the broken voice architecture** from the dirty tree. That is why symptoms persisted after rollback.

---

## Error-by-error root cause

### 1. `Cannot find native module 'ExpoSpeechRecognition'`

| Field | Value |
|-------|-------|
| **File** | `src/hooks/useVoiceRecognition.ts` (builds ≤163 dirty tree) |
| **Line** | `require('expo-speech-recognition')` inside `loadSpeechModule()` |
| **Component** | `useVoiceRecognition` → imported by `(tabs)/workout.tsx` at **module load** |
| **Root cause** | **SDK/package mismatch:** app uses **Expo SDK 54** but `expo-speech-recognition@56.x` in `package.json`. Native plugin was removed from `app.config.ts` in stabilization, but JS still `require()`'d the module when tabs mounted. Missing native module → **fatal crash before mic is tapped**. |
| **Why rollback failed** | Dirty-tree voice files + autolinked package still present in EAS archive |

### 2. `Cannot read property 'WorkoutVoiceControlsLive' of undefined`

| Field | Value |
|-------|-------|
| **File** | `src/components/workout/WorkoutVoiceControls.tsx` (uncommitted) |
| **Line** | `require('./WorkoutVoiceControlsLive')` → `.WorkoutVoiceControlsLive` on undefined |
| **Component** | `WorkoutVoiceControls` imported by `(tabs)/workout.tsx` |
| **Root cause** | Safe-loader pattern used `require()` without null check; named export file deleted or failed to resolve on native |
| **Stack** | Tab mount → import WorkoutVoiceControls → require undefined module |

### 3. `Cannot read property 'NutritionVoiceMicActive' of undefined`

| Field | Value |
|-------|-------|
| **File** | `src/components/nutrition/NutritionVoiceMic.tsx` (uncommitted) |
| **Line** | Top-level `import { NutritionVoiceMicActive } from './NutritionVoiceMicActive'` |
| **Component** | `NutritionVoiceMic` imported by `(tabs)/nutrition.tsx` |
| **Root cause** | Same as #2 — module resolution returned undefined; property access at render |

### 4. `EXC_BAD_ACCESS` (Hermes)

| Field | Value |
|-------|-------|
| **Likely file** | `node_modules/expo-router/build/fork/extractPathFromURL.js` |
| **Line** | `url.match(...)` during cold-start deep link parsing |
| **Root cause** | Hermes crash in `String.prototype.match` on launch URL — observed in prior Sprint 8.7 investigation. Can occur **independently** of tab/voice bugs. |
| **Contributing factor** | Slow first launch: `FontProvider` loads 40+ font files; `AuthContext` + `SubscriptionContext` + Sentry init on startup |

### 5. Slow first open (minutes), fast relaunch

| Cause | Detail |
|-------|--------|
| Font loading | `@expo-google-fonts/inter`, `manrope`, `sora` — many TTF assets on first boot |
| Cold-start services | Supabase session restore, RevenueCat sync, Sentry native init |
| Not a separate crash bug | Explains delay before crash surface appears |

---

## Boot test protocol

**Build profile:** `diagnostic-boot-test`  
**Env:** `EXPO_PUBLIC_BOOT_TEST=true`, `EXPO_PUBLIC_DIAGNOSTIC_STAGE=boot`

Disables: Supabase, RevenueCat, Workout, Nutrition, Voice, notifications init, Sentry wrap, custom fonts, all providers.

Shows only: **BOOT TEST**

### Binary search stages

Set `EXPO_PUBLIC_DIAGNOSTIC_STAGE` to re-enable one subsystem at a time:

```
boot → supabase → revenuecat → workout → nutrition → voice → notifications → ai → full
```

Build after each stage change. First stage that crashes = root cause layer.

---

## Forensic logging

All markers log to console as `[FORENSIC] MARKER {...}`:

- `APP_START`, `APP_BOOT_COMPLETE`, `APP_CRASH`
- `SUPABASE_INIT_*`, `REVENUECAT_INIT_*`
- `WORKOUT_LOAD_*`, `NUTRITION_LOAD_*`, `VOICE_INIT_*`

Screen error boundaries on: Home, Workout, Nutrition, Profile (Settings).

---

## Exact fix (once boot test passes incremental stages)

1. **Never ship uncommitted files** — enforce `.easignore` + clean git before EAS build
2. **Remove or align `expo-speech-recognition`** — either add plugin matching SDK 54 compatible version, or remove package from autolinking until voice reintroduced
3. **No top-level voice imports on tab screens** — voice must be lazy-loaded behind availability gate after native module verified
4. **Reintroduce subsystems one at a time** per diagnostic stages above

---

## Boot test result

**Device verification required.**

| Question | Answer |
|----------|--------|
| Does boot test crash? | **PENDING** — Build not yet submitted to TestFlight |

After installing diagnostic build, report YES or NO.
