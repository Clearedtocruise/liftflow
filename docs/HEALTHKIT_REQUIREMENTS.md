# HealthKit Requirements — LiftFlow

**Sprint 8.4 · Recovery + Watch companion**

## Data types read

| Type | HealthKit identifier | Used for |
|------|---------------------|----------|
| Steps | `StepCount` | Activity baseline |
| Active calories | `ActiveEnergyBurned` | Training load |
| Heart rate | `HeartRate` | Workout intensity |
| Resting heart rate | `RestingHeartRate` | Recovery trend |
| HRV | `HeartRateVariabilitySDNN` | Recovery score |
| Sleep | `SleepAnalysis` | Recovery score |
| Weight | `BodyMass` | Body composition |
| Workouts | `Workout` | Cross-check sessions |

Implementation: `src/integrations/healthkitProvider.ts`

## Permissions

Configured in `src/integrations/healthConstants.ts`. User grants read access on first sync from **Settings → HealthKit** (`/(features)/healthkit`).

## Pro gating

HealthKit sync UI is Pro-gated (`healthkit-sync`). Free users can log workouts manually; recovery intelligence uses Health data when connected.

## Dev build requirement

HealthKit **does not work in Expo Go**. Use:

```bash
npm run build:ios:dev
```

Verify with:

```bash
node scripts/verify-healthkit-dev-build.mjs
```

## Background delivery (audit checklist)

For production recovery accuracy:

1. Enable `HKObserverQuery` for resting HR, HRV, and sleep on native iOS module
2. Register background delivery for recovery-critical types
3. Debounce sync to Supabase (`healthkit_sync_records`) — max 1/hour unless workout active
4. Document battery impact in App Store review notes

Current status: **foreground sync only** — background delivery is a post-8.4 native task.

## Watch companion

Live HR during workouts uses Watch → Phone `heart_rate_sample` messages. Aggregated recovery metrics sync via phone HealthKit reads.

## Privacy

- Health data stored in Supabase per-user with RLS
- Not used for advertising
- Disclosed in App Store Privacy Nutrition Labels: Health & Fitness
