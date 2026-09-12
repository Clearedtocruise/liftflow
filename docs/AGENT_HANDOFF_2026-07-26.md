# Agent handoff — 2026-07-26

Context for a fresh cloud agent picking up this work. Written because Supabase and Render
credentials were added mid-session, and injected secrets only reach a VM at boot.

Previous run: https://cursor.com/agents/bc-6484ef33-fd8d-46c1-9feb-86e01e13b5d3

---

## 1. Shipped this session

### TestFlight build 323

Built and submitted from `main` at `100a54e` using `EXPO_TOKEN1`.

| Item | Value |
|------|-------|
| Expo project | `@liftflow1/liftflow` (`62d95ef4-66d9-4638-8e66-93d27e1fb48d`) |
| Build | `15281f1d-ad37-40df-8c8f-ebeec1c122ff`, iOS production, `appBuildVersion` 323 |
| Submission | `d819012f-78d4-4387-b497-b72fff4933ee` — upload succeeded, Apple processing |
| ASC app id | `6775314524`, team `DZXP5Q6649` |

`EXPO_TOKEN1` authenticates as **liftflow1** (`clearedtocruise@gmail.com`), which also owns the
`one-more-fitness` Expo account.

### PR #12 — active workout progression bugs

Branch `cursor/fix-active-workout-progression-bugs-b5d3` → https://github.com/Clearedtocruise/liftflow/pull/12

Six bugs reported from build 323, all root-caused:

| Report | Root cause |
|--------|-----------|
| Hammer Row switched to distance | `CARDIO_NAME_PATTERN` matched a bare `row`, so every pulling lift classified as cardio. The backend mirror already had the fix; the app copy had drifted. |
| Froze asking for another set after 4 sets | `alignPlanExercisesToSession` derived a swapped-in exercise's set target from `sets.length`, so the target climbed with every set logged and the exercise never completed. |
| Logged barbell set deleted after rest | `applySessionExercisePlanInternal` deleted exercises not named in the plan **along with their sets**. An exercise added mid-workout is never in the plan. |
| "20 exercises" | Same routine appended a duplicate row when a plan name resolved to an exercise already in the session under a different spelling. |
| Could not replace an exercise mid-sets | No mid-session replace existed at all. Added `workoutService.replaceExercise` + a Swap Exercise action. |
| Add exercise jumped to the end | `addExercise` always appended and `handleAddExercise` force-navigated; `Previous` was also blocked during rest. |

### PR #13 — exercise guide detail view

Branch `cursor/exercise-guide-detail-ui-b5d3` → https://github.com/Clearedtocruise/liftflow/pull/13

Rebuilt `ExerciseGuideSheet` toward the user's mock: phase-by-phase movement walkthrough with
autoplay, sections for Breathing / Key cues / Avoid / Scale It, muscles with a male-female toggle,
equipment and difficulty chips, and a Details → Add to Workout flow in the exercise picker.

New: `src/lib/exerciseGuideSections.ts`, `src/lib/exerciseDifficulty.ts`,
`src/components/exercise/ExerciseMovementPhases.tsx`.

---

## 2. Outstanding work

### A. Screenshot of the new guide UI — **do this before any build**

The user explicitly asked to see the UI before another build is cut:

> "when you're done with the UI, I want to see a picture of it before we do any kind of builds"

Approach that was in progress (render the **real** component, not a mockup):

1. Chrome is at `/usr/local/bin/google-chrome`; `scripts/render-ux-previews.mjs` shows the
   puppeteer pattern already used in this repo, but it draws hand-written HTML — do not reuse its
   markup, it is not the real component.
2. Write `.env` (gitignored) with the publishable values from `eas.json`, or
   `src/supabase/client.ts` throws on import:
   ```
   EXPO_PUBLIC_API_URL=https://liftflow-api.onrender.com
   EXPO_PUBLIC_SUPABASE_URL=https://jaajsalblkjtmrapijbe.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_l_d781eIJciTmAKZh0sjsQ_0NwmvDRA
   ```
3. Add a temporary route `src/app/ui-preview.tsx` rendering `ExerciseGuideSheet` with `visible`
   and a fixed `Exercise` (bench press works well — it has a full form guide). The root layout has
   no auth redirect, so a top-level route renders inside `AppProviders` without a session.
4. `EXPO_USE_METRO_STUBS=1 npx expo start --web` (the stubs are required — HealthKit,
   nitro-modules and Purchases have no web build), then screenshot `/ui-preview` at 390×844.
5. **Delete the temporary route before committing.** It would otherwise ship as a reachable
   deep link in the production bundle.

### B. Voice logging — diagnosed, not implemented

The pipeline is real and wired: `expo-av` records → `POST /api/voice/transcribe` → OpenAI
`gpt-4o-transcribe` → parse locally or via `POST /api/voice/parse`. There is **no** on-device
speech recognition, so it requires network and a valid Supabase session.

The concrete code bug is strict name equality:

```ts
// src/components/workout/execution/ActiveWorkoutScreen.tsx (handleVoiceLogSet)
if (payload.exerciseName.trim().toLowerCase() !== activeName.trim().toLowerCase()) {
  AccessibilityInfo.announceForAccessibility(...);
  return false;
}
```

Saying "bench press 225 for 8" while the current exercise is "Barbell Bench Press" transcribes and
parses correctly, then fails at save with the generic caption *"Could not save that set. Try logging
it manually."* Sighted users get no reason why — only the accessibility announcement explains it.

Suggested fix: compare normalized names with substring/token overlap rather than exact equality,
and when it genuinely is a different exercise, say so visibly instead of failing generically.

Secondary findings (not user-reported, worth knowing): `speakVoiceConfirmation` in
`src/lib/voice/voiceFeedback.ts` is never called; "continuous" input mode behaves like tap-toggle;
wake phrase is "Coming soon"; `NSSpeechRecognitionUsageDescription` is declared in `app.config.ts`
but unused; `docs/LLM_REVIEW_PACKAGE.md` still claims `expo-speech-recognition`, which is not
installed.

### C. Saving edited daily workouts — diagnosed, not implemented

The user's report:

> "I'd like to be able to revise daily workouts and then save them. When I edit a daily workout, if
> I leave the app it doesn't save and I have to go back and do it again if I'm not ready to start
> the workout now."

Confirmed from code:

- `WorkoutEditScreen` routes every mutation through `onChange` → `setExercises`, and `Done` only
  calls `router.back()`. There is no save call anywhere in the edit flow.
- `WorkoutPlanDraftContext` is plain `useState` with no AsyncStorage, so the draft dies on app kill,
  provider remount, or any `setPlannedWorkout` that reloads from the database.
- `workout/index.tsx` uses `useFocusEffect` and can call `setPlannedWorkout(today.workout)`, which
  resets the draft from the database and wipes unsaved edits.
- Only **Replace on the day overview** persists, via
  `trainingService.updatePlannedWorkoutExercises` in `day.tsx`. Add, remove, reorder and rest
  changes are all lost.
- Starting a workout does **not** save edits to `planned_workouts.metadata.exercises` either — it
  builds the session from the database snapshot, not the draft.

Suggested fix: save on `Done` in `src/app/(tabs)/workout/edit.tsx` via
`updatePlannedWorkoutExercises(plannedWorkout.id, exercises, plannedWorkout.metadata)`, mirroring
the optimistic-update-with-rollback in `day.tsx`'s `handleReplaceExercise`. Consider persisting the
draft to AsyncStorage so backgrounding mid-edit is not destructive, and have `handleStart` use the
draft once saving exists.

### D. Duplicate exercises — needs database access to finish

The user's screenshot showed every exercise listed exactly twice (Dumbbell Curl ×2, Hammer Curl ×2,
Spider Curl ×2, Reverse Crunch ×2, Crossbody Carry ×2) with `Hammer Low Row — Set 1: 0 lb × 0 reps`.

That screen is `WorkoutSummaryScreen`, which renders `session.exercises`, so these are duplicate
`workout_exercises` rows in the session — not a rendering artifact and not the plan template.
PR #12 stops new duplicates and drops empty ones on the next plan apply.

**What could not be verified without credentials:** whether the user's existing rows match that
shape, whether other sessions are affected, and whether a one-time cleanup is needed rather than
relying on self-healing. With `SUPABASE_SERVICE_ROLE_KEY` available, inspect:

```sql
select we.session_id, e.name, count(*)
from workout_exercises we join exercises e on e.id = we.exercise_id
group by 1, 2 having count(*) > 1;
```

Also check `planned_workouts.metadata->'exercises'` for duplicate entries, and
`select name, count(*) from exercises group by 1 having count(*) > 1` — the adaptive planner
dedupes by **slug only** (`backend/src/lib/workoutPlanner.ts` lines ~707 and ~824), so two catalog
rows sharing a display name would both survive into a plan.

Two related generator bugs found by reading, not yet fixed:

1. `backend/src/lib/liftingReference/referenceProgramLoader.ts` lines 444–462 — `exercises` is
   shortened by `dedupeExercisesByName`, then `withBlocks` maps over the **full** `draft` and reads
   `exercises[index]`. After any removal the indices misalign, and trailing indices are `undefined`,
   so `{...undefined, block, metadata}` yields entries with no name or sets. Fix by carrying
   `block`/`metadata` on the objects through the transforms instead of rejoining by index;
   `applySubstitutionsToExercises` and `applyWeeklyProgression` both spread `...exercise`, so extra
   fields already survive. `applyWeeklyProgression` should be made generic to keep the types honest.
2. The adaptive planner should dedupe by normalized display name in addition to slug.

### E. Repository rename — blocked on GitHub permissions

The user wants one repository named after the company, One More, and no LiftFlow naming. `Clearedtocruise`
must not be touched.

There is only one repo, `Clearedtocruise/liftflow`; no One More repo exists. The agent's GitHub token
is read-only for repo administration (`PATCH /repos/...` returns 403), so the rename has to be done
by the owner at https://github.com/Clearedtocruise/liftflow/settings → Repository name → `one-more`.

After the rename, update the hardcoded URLs: `render.yaml`, `scripts/deploy-render.mjs`,
`scripts/create-render-service.mjs`, `scripts/push-main-via-api.mjs`,
`scripts/push-sprint87-via-api.mjs`, `scripts/github-push-via-api.mjs` and the commit links in
`docs/SPRINT87_EXECUTION_STATUS.md` and `docs/SPRINT79_COMPLETION_MISSION.md`.

Roughly 1,200 case-insensitive `liftflow` hits across ~274 files. Safe to rename: `LiftFlowColors`,
`LiftFlowLogo`/`LiftFlowWordmark`, `why-liftflow` route, `whyLiftFlow` constants, `package.json`
name, docs. **Do not rename** without a migration plan: `com.liftflow.app` and
`com.liftflow.app.watch`, `group.com.liftflow.app`, the IAP ids
`com.liftflow.app.premium.monthly` / `liftflow_premium_monthly`, the Expo project id / owner / slug,
the `liftflow://` URL scheme (auth deep links, Strava callback, Supabase redirect allowlist), the
`liftflow-api.onrender.com` host, and the `LIFTFLOW-*` beta invite codes already seeded in Supabase.
Apple does not allow renaming a live app's bundle id, and users only ever see "One More Fitness".

---

## 3. Environment notes

- **Secrets reach a VM at boot.** This run only ever had `EXPO_TOKEN` and `EXPO_TOKEN1`; Supabase
  and Render keys added mid-session never appeared. Verify with
  `echo $CLOUD_AGENT_INJECTED_SECRET_NAMES` before assuming access. Note that for public repos
  secret injection can be disabled by default, and `liftflow` is public.
- `eas-cli` is not preinstalled and `/usr/lib/node_modules` is not writable. Use
  `npm install -g eas-cli --prefix "$HOME/.local"` and add `$HOME/.local/bin` to `PATH`.
- `npm ci` in the repo root does not install `backend/node_modules`. Run `npm ci` in `backend/`
  before `validate:sprint1-exercise-classification`, or its unit-test check reports
  "tsx not installed in backend".
- `npm run lint` writes an untracked `eslint.config.js` on first run. Delete it before committing;
  it is not part of the repo.
- Long EAS builds and submissions should be run in tmux — a build takes roughly 7 minutes and a
  submission a further 3.

### Known-good baselines

Do not chase these; they are pre-existing on `main` and unrelated to this work.

| Check | Baseline |
|-------|----------|
| `npm run typecheck` | 58 errors |
| `npm run lint` | 115 problems (18 errors, 97 warnings) |
| `validate:critical-paths` | 3 failures (dashboard plan load, `HomeNextUpCard` missing, smart replace macros) |
| `validate:sprint1-exercise-classification` | 26/28 — catalog is 63 entries, validator expects 37 |
| `validate:sprint5-active-workout` | 16/17 |

Compare against the baseline by stashing changes rather than reading absolute counts.

### Verification commands

```bash
npm run validate:active-workout-progression   # PR #12 guard
npm run validate:exercise-guide               # PR #13 guard
cd backend && npx tsx src/lib/exerciseClassification.test.ts
npm run typecheck && npm run lint
```

---

## 4. Suggested prompt for the next run

> Read `docs/AGENT_HANDOFF_2026-07-26.md` on branch `cursor/session-handoff-b5d3` first.
>
> Then, in this order:
> 1. Produce a real screenshot of the new exercise guide UI from PR #13 (branch
>    `cursor/exercise-guide-detail-ui-b5d3`) and show it to me. No new builds until I have seen it.
> 2. Fix voice logging (section B).
> 3. Make edited daily workouts save without starting the workout (section C).
> 4. Using the Supabase service-role key, confirm the duplicate `workout_exercises` rows and write a
>    cleanup for rows already broken (section D).
