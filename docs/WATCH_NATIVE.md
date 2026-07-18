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

1. **Motion rep counting** — `MotionCapture.swift` streams 25 Hz accelerometer/gyro batches as `motion_batch` during active sets (motion-tracked exercises only).
2. **Voice on wrist** — Dictation via `presentTextInput` plus quick chips (“Log set”, “How recovered am I?”).
3. **Richer UI** — Recovery score, progression line, rep count, confidence bar, confirm reps when low confidence.
4. **Start from Watch** — “Start Today's Workout” sends `start_workout` to iPhone (starts today's planned session).

Phone-side handlers were already in `watchWorkoutService` / `watchCompanionService`; Phase 2 wires the native Watch app to use them.

### Complications (Phase 2.5)

Watch face complications for rest timer / active workout are not yet implemented.

## Auto-present workout UI (OS limits)

When a strength session starts on iPhone, the phone sends `presentWorkout: true` with the WatchConnectivity `workout_state` payload. The Watch target starts an `HKWorkoutSession` / live builder and presents the companion workout UI when it can receive the message.

**watchOS cannot force-launch a cold companion from the phone.** WatchConnectivity delivery only helps if the Watch app is installed and the session can wake or reach it. If the Watch is locked, unreachable, or the app was never opened after install, the user may need to open ONE MORE on the Watch (or wait for a later `request_sync`) before live sets/HR/Active cal appear. This is an Apple platform limit — not a LiftFlow bug.

Closest supported path: start HealthKit workout session + `presentWorkout` so system workout UI / extended runtime engages as soon as the Watch app can receive the message.

## Dev without Watch hardware

- Open `/(features)/apple-watch`
- Start a phone workout → **Sync active workout**
- **Simulate rep (dev)** feeds synthetic motion through the same pipeline

## Backend API (optional direct Watch → API)

- `GET /api/watch/supported-exercises`
- `POST /api/watch/motion` (auth required)
- `POST /api/watch/voice` (auth required, user-scoped progression)

Deploy Render after adding routes in `backend/src/routes/watch.ts`.
