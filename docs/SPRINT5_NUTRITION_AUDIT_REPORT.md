# Sprint 5 — Nutrition Calculation Audit Report

**Date:** 2026-06-12  
**Status:** Fixed (pending TestFlight validation)

## Objective

Fix data trust for nutrition calories, protein, daily totals, weekly totals, and duplicate meal/log counting.

---

## Findings

### 1. Daily calories/protein — client surfaces

| | |
|--|--|
| **Expected** | Sum macros only from deduped, consumed meals (`completed`, `modified`, or ad-hoc non-plan logs) |
| **Actual (before)** | Partially correct on Nutrition tab, Dashboard, and `getDailySummary` after commit `3f84085`; duplicate DB rows could still exist until prune ran |
| **Root cause** | Duplicate `date:meal_type` rows in `meals` table; aggregation added but not universal |
| **Fix** | `aggregateDailyMeals()` + `pruneDuplicateMeals()` on tab load; shared consumed-meal rules |

### 2. Daily calories/protein — Nutrition Intelligence API

| | |
|--|--|
| **Expected** | Same consumed + deduped totals as Nutrition tab |
| **Actual (before)** | Raw sum of all today meal rows (duplicates + unlogged planned meals counted) |
| **Root cause** | `loadNutritionIntelligence.ts` predated aggregation layer |
| **Fix** | Backend `mealAggregation.ts`; loader now calls `aggregateDailyMeals(todayMeals)` |

### 3. Weekly totals

| | |
|--|--|
| **Expected** | Sum of per-day deduped consumed/planned totals for Mon–Sun |
| **Actual (before)** | No weekly rollup; week tab showed per-meal lines only |
| **Root cause** | Missing `aggregateWeeklyMeals()` |
| **Fix** | Added client + backend weekly aggregation; Week tab shows summary card |

### 4. Duplicate meal counting

| | |
|--|--|
| **Expected** | One canonical row per `scheduled_date + meal_type`; newest completed wins |
| **Actual (before)** | Multiple rows from repeated plan generation inflated totals on intelligence path |
| **Root cause** | No slot dedupe on read in backend intelligence loader |
| **Fix** | `pickMealsToKeep()` / `dedupeMealsByType()` everywhere totals are computed; DB prune on load |

### 5. Adherence / log days

| | |
|--|--|
| **Expected** | Count days with at least one consumed meal (after dedupe) |
| **Actual (before)** | Counted distinct dates with any meal row (including duplicates and unlogged planned) |
| **Root cause** | `new Set(meals7d.map scheduled_date)` in intelligence loader |
| **Fix** | `countNutritionLogDays()` using daily aggregation |

---

## Fix plan (implemented)

1. **Shared aggregation** — `src/lib/mealAggregation.ts` + `backend/src/lib/mealAggregation.ts`
2. **Backend intelligence alignment** — `loadNutritionIntelligence.ts`
3. **Weekly rollup** — `aggregateWeeklyMeals()` + Nutrition Week tab summary
4. **Validation** — `backend/src/lib/mealAggregation.test.ts` (5 cases)
5. **Gate script** — `npm run validate:sprint5-nutrition`

---

## Surfaces using canonical aggregation

| Surface | Function |
|---------|----------|
| Nutrition → Today header | `aggregateDailyMeals` |
| Nutrition → Week totals | `aggregateWeeklyMeals` |
| Dashboard macros | `aggregateDailyMeals` |
| `nutritionService.getDailySummary` | `aggregateDailyMeals` |
| `analyticsService.getDashboard` | `aggregateDailyMeals` |
| Nutrition Intelligence API | `aggregateDailyMeals` + `countNutritionLogDays` |

---

## Validation

Run:

```bash
npm run validate:sprint5-nutrition
```

See `docs/SPRINT5_VALIDATION_REPORT.md` for latest run output.

---

## Acceptance criteria

| Criterion | Status |
|-----------|--------|
| Daily calories correct | ✅ Fixed (all surfaces aligned) |
| Daily protein correct | ✅ Fixed |
| Weekly totals correct | ✅ Fixed (Week tab + backend helper) |
| No duplicate counting | ✅ Fixed (dedupe + prune) |

**Do not build until approved.**
