# Apple Watch Native Companion

The TypeScript workout assistant (`src/integrations/watch/`, `watchWorkoutService.ts`) is ready on iPhone. A native **watchOS** target streams motion and receives state via WatchConnectivity.

## Architecture

```mermaid
flowchart LR
  Watch[watchOS CoreMotion] -->|motion_batch| Phone[iPhone LiftFlow]
  Phone -->|workout_state| Watch
  Watch -->|voice_command| Phone
  Phone --> Supabase[(workout_sets / rep_count_events)]
```

## Message types (WatchConnectivity)

| type | Direction | Payload |
|------|-----------|---------|
| `workout_state` | Phone → Watch | Full `WatchWorkoutAssistantState` |
| `motion_batch` | Watch → Phone | `samples[]`, `workoutSessionId` |
| `voice_command` | Watch → Phone | `transcript` |
| `rep_correction` | Watch → Phone | `repCount`, ids |
| `confirm_reps` | Watch → Phone | session + exercise ids |

Phone entry: `integrationService.handleWatchMessage()` → `watchWorkoutService.handleIncomingMessage()`.

## watchOS implementation checklist

1. Add **Watch App** target to the Expo dev client / bare workflow Xcode project.
2. Enable **Workout Processing** and **HealthKit** if sharing HR.
3. On workout start, subscribe to `CMMotionManager`:
   - `deviceMotionUpdateInterval` ≈ 0.04s (25 Hz)
   - Batch 20–30 samples, send `motion_batch` to phone.
4. Run **WKExtendedRuntimeSession** during active sets so sensors stay live.
5. Use **WatchConnectivity** `WCSession.sendMessage` for low-latency batches.
6. Present SwiftUI UI: rep count, confidence bar, “Confirm” / “+1 rep” buttons.
7. Optional: **Siri / dictation** → forward transcript as `voice_command`.

## Confidence & fallback

- Rep detection runs in `detectRepsFromMotion()` (peak detection on accelerometer/gyro).
- If `confidence < 0.55`, phone/watch prompts for confirmation.
- User can say **“Correct to rep 8”** or tap manual correction (Apple Watch screen).

## Supported exercises

See `EXERCISE_MOTION_PROFILES` in `src/integrations/watch/exerciseMotionProfiles.ts` (Bench Press, Squats, Rows, etc.).

## Phase 2 (watchOS companion)

Shipped in native target `targets/watch/`:

1. **Motion rep counting — NOT SHIPPED.** `MotionCapture.swift` exists but is never instantiated, so no
   accelerometer/gyro batches are sent and no reps are ever detected. The phone-side pipeline
   (`motion_batch` handling, `EXERCISE_MOTION_PROFILES`, `/api/watch/motion`) is scaffolding awaiting a
   real sensor/ML implementation. User-facing surfaces must present this as coming soon.
2. **Voice on wrist** — Dictation via SwiftUI `TextFieldLink`. (`presentTextInputController` cannot be
   used: it needs a WatchKit interface controller, which does not exist under the SwiftUI lifecycle.)
3. **Richer UI** — Recovery score, progression line, rep count, confirm reps.
4. **Start from Watch** — “Start Today's Workout” sends `start_workout` to iPhone (starts today's planned session).
5. **Live workout session** — `WorkoutSessionManager.swift` runs an `HKWorkoutSession` +
   `HKLiveWorkoutBuilder` for the duration of the workout so watchOS does not suspend the app on
   wrist-down. Requires `WKBackgroundModes: workout-processing` (Info.plist) and the HealthKit
   entitlement. The session stays running through rest periods, and is ended and saved to Health when
   the workout finishes or is cancelled.
6. **Rest timer** — The phone transmits a rest deadline only on meaningful transitions (start, change,
   clear); the watch counts down locally from there. Re-arming on every tick froze the display.

Phone-side handlers were already in `watchWorkoutService` / `watchCompanionService`; Phase 2 wires the native Watch app to use them.

### Complications (Phase 2.5)

Watch face complications for rest timer / active workout are not yet implemented.

## Dev without Watch hardware

- Open `/(features)/apple-watch`
- Start a phone workout → **Sync active workout**
- Enter a rep count manually to drive the same logging pipeline

## Wrist logging without the workout screen

`useWatchCompanionSync` runs from `AppProviders`, so it registers a **fallback log-set handler**
for the whole app session. A wrist tap now logs against the active session from any phone screen —
or with the phone in a pocket.

- `ActiveWorkoutScreen` still registers the **rich** handler while it is mounted (supersets, rest
  flow, progression, PR detection). `watchPhoneBridge.logCurrentSet()` prefers it and falls back
  automatically when the screen unmounts.
- The fallback resolves what to log in `src/lib/watchLogSet.ts`: dictated reps/weight first, then
  the last set on that exercise, then the plan. It refuses with a spoken reason when the workout is
  paused, finished, or absent.
- It logs through `WorkoutSessionContext.logSet`, so the session refresh and rest timer behave
  exactly as they do on the phone, and the updated state is pushed straight back to the watch.

## Owning the wrist

On watchOS the app with a running `HKWorkoutSession` is the one shown on wrist raise. If ours is
not running, the raise goes to whatever else claims a workout — in practice the Fitness app, which
looks like ONE MORE being taken over the moment the wrist drops.

`WorkoutSessionManager.start()` therefore resolves HealthKit authorization *before* creating the
session; creating it while the permission prompt is still outstanding fails and leaves the app with
no session at all. The request is intent-tracked (`wantsSession`) so a workout that ends mid-prompt
does not start a stray session, and `ContentView` re-asserts on `scenePhase == .active`, so a
session lost to another app is reclaimed on the next raise rather than for the rest of the workout.

Denied Health access surfaces as an error on the watch — without the entitlement the session
cannot run and the takeover is expected.

## Known follow-ups

- Watch-side motion rep counting (see item 1 above) remains unimplemented — `MotionCapture.swift`
  is not instantiated by `ContentView`.
- Watch heart rate is read locally for calorie estimates but never sent to the phone.
- The recovery score arrives in `WorkoutConnectivity` but is not rendered in the watch UI.

## Backend API (optional direct Watch → API)

- `GET /api/watch/supported-exercises`
- `POST /api/watch/motion` (auth required)
- `POST /api/watch/voice` (auth required, user-scoped progression)

Deploy Render after adding routes in `backend/src/routes/watch.ts`.
