# Sprint 6 — Recovery & Readiness Audit Report

**Date:** 2026-06-10  
**Status:** Fixed (pending TestFlight validation)

## Objective

Make recovery metrics transparent and trustworthy — document formulas, verify inputs, and remove misleading placeholder scores.

---

## Metric definitions

### Recovery % (composite)

Shown on Home (Pro) and Recovery Intelligence screen.

```
Recovery % = clamp(
  subjectiveScore × 0.45
  + trainingLoadScore × 0.30
  + muscleReadinessScore × 0.25
  + trendAdjustment,
  0, 100
)
```

| Component | Weight | Source |
|-----------|--------|--------|
| Subjective | 45% | Daily check-in (`recovery_assessments`) ± HealthKit sleep |
| Training load | 30% | 3-day sessions, volume, consecutive days, avg duration |
| Muscle readiness | 25% | Per-muscle scores averaged (see Readiness % below) |
| Trend | ±5% of 14-day delta | Historical `recovery_score` rows |

### Subjective score (check-in)

From `backend/src/lib/recoveryScore.ts`:

| Input | Weight | Notes |
|-------|--------|-------|
| Sleep hours | 25% | 7–9h optimal |
| Sleep quality | 20% | 1–10 scale |
| Energy | 25% | 1–10 scale |
| Stress | 15% | Inverted |
| Soreness | 15% | Inverted |

**Missing fields default to 70** (neutral estimate, flagged in UI as `estimatedFromDefaults`).

### Readiness % (muscle readiness factor)

Not a separate headline metric — it is the **25% muscle readiness component** labeled **Readiness** in the factor breakdown.

Per-muscle score starts at 100 and subtracts for:
- Hours since last trained (<24h → −38, scaling to −4 by 96h)
- Untrained muscle in 7d → 98
- Weekly volume tiers (>20k → −18, etc.)
- Weekly set count tiers
- Global soreness (≥8 → −14)

`muscleReadinessScore` = average of all tracked muscle groups (default **75** when no workout data).

---

## Data source map

| Data | Table / API | Used for |
|------|-------------|----------|
| Check-in | `recovery_assessments` | Subjective inputs, stored score, trend |
| Check-in submit | `POST /api/training/recovery/check-in` | Computes + persists score |
| Today row | `GET /api/training/recovery/today` | Free tier Home score |
| Intelligence | `GET /api/training/recovery/intelligence` | Pro composite + transparency |
| Trend | `GET /api/training/recovery/trend` | 14-day chart + trend adjustment |
| Workouts | `workout_sessions` + exercises/sets | Load + muscle readiness |
| Sleep | `loadHealthContext()` / HealthKit | Fallback sleep hours |

---

## Audit findings (before fix)

| Issue | Severity | Fix |
|-------|----------|-----|
| Dashboard faked **88/72/65** when score null | High | Empty state + "Check in for your score" |
| No formula documentation in app | High | "How this score works" card + `transparency` payload |
| "Readiness" undefined in UI | Medium | Renamed factor chip; subtitle explains Readiness % |
| Missing inputs silently default to 70 | Medium | Flagged as `estimatedFromDefaults` |
| No audit docs / validation gate | Medium | This report + `validate:sprint6-recovery` |

### Remaining internal fallbacks (not user-facing)

| Location | Value | Context |
|----------|-------|---------|
| `progressionService.ts` | 72 | Offline smart progression only |
| `loadSmartProgression.ts` | 72 | Missing DB row |
| `postWorkoutCoach.ts` | 72 | Missing DB row |
| `workoutPlanner.ts` | 85 | Missing recovery row in modifiers |

These are backend/offline defaults, not displayed as the user's Recovery %.

---

## Surfaces

| Surface | Score shown | Transparency |
|---------|-------------|--------------|
| Home → Recovery card | Composite (Pro) or check-in row (Free) | Partial check-in warning |
| Recovery Intelligence | Full composite + factors | Full breakdown |
| Workout Next Up | Real score or "Complete check-in" | No fake % |

---

## Validation

```bash
npm run validate:sprint6-recovery
```

Unit tests:
- `backend/src/lib/recoveryScore.test.ts`
- `backend/src/lib/recoveryIntelligenceEngine.test.ts`
