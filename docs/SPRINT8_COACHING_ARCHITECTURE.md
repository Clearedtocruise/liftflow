# Sprint 8 — AI Coaching Architecture

## Goal

Unify fragmented coaching signals (smart progression, recovery intelligence, program phase, nutrition adherence) into a single per-exercise prescription surfaced during workout planning and active logging.

## Backend

### `exerciseCoachPrescription.ts`

Central loader that merges:

| Source | Data used |
|--------|-----------|
| `loadSmartProgression` | Weight/rep targets, adjustment type, `detailedReason`, confidence |
| `loadCoachContext` | Recovery score, nutrition today vs target, program sprint phase |
| `loadRecoveryIntelligence` | Muscle readiness score |
| `recovery_assessments` metadata | Volume multiplier for set count |
| Profile | Available equipment for "why selected" copy |

**Outputs:** `ExerciseCoachPrescription` with full targets (sets, reps, weight, rest), adjustment label, short reason, expanded `detailedReason`, and `whySelected` bullets.

**Set logic (`resolveTargetSets`):**

- Deload phase or recovery &lt; 45 → −25% sets
- Recovery volume multiplier &lt; 0.85 → scale sets
- High recovery + readiness → +1 set (cap at 5 planned)

**New adjustment type:** `increase_sets` when set count rises above plan.

### API routes (`training.ts`)

| Route | Purpose |
|-------|---------|
| `POST /api/training/coaching/exercise-prescription` | Single exercise during active workout |
| `POST /api/training/coaching/workout-prescriptions` | Batch for day overview |

Both require Pro subscription (same gate as smart progression).

## Client

| Module | Role |
|--------|------|
| `exerciseCoachService.ts` | API client for prescription endpoints |
| `ExerciseCoachCard.tsx` | Inline/default/compact UI with reasoning expansion |
| `coachAdjustmentLabels.ts` | Human labels + semantic colors |
| `WorkoutExerciseDetailList.tsx` | Pre-workout list with coach targets + `detailedReason` |
| `ActiveWorkoutScreen.tsx` | Replaces `SmartProgressionCard` with full prescription |

`SmartProgressionCard` remains for backward compatibility in other surfaces; active workout is the primary Sprint 8 integration point.

## Data flow

```
Planned workout exercise
        │
        ▼
loadExerciseCoachPrescription(userId, exerciseId, plan)
        │
        ├── smart progression (weight/reps/reason)
        ├── recovery + readiness
        ├── set resolver
        └── whySelected builder
        │
        ▼
ExerciseCoachCard / WorkoutExerciseDetailList
```

## Validation

```bash
npm run validate:sprint8-coaching
```

Checks file presence, route wiring, UI integration, and unit tests for set mapping and why-selected copy.

## Follow-ups (post-Sprint 8)

- Surface prescriptions on exercise detail screen (`exercise/[id].tsx`)
- Deprecate direct `SmartProgressionCard` usage where prescription card is equivalent
- Cache batch prescriptions per workout day to reduce API calls
