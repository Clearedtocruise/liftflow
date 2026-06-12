# Sprint 7 — Equipment & Preference Adaptation Report

**Date:** 2026-06-12  
**Status:** Fixed (pending TestFlight validation)

## Objective

ONE MORE must immediately adapt when user equipment or nutrition preferences change — today’s workout, future workouts, and planned meals.

---

## Implementation

### Equipment substitution engine

`backend/src/lib/equipmentSubstitutionEngine.ts`

- Named swaps (Sprint 7 examples):
  - **Cable Fly → Push-Up** (or Dumbbell Bench Press when available)
  - **Lat Pulldown → Pull Up** (when pull-up bar available)
- Generic fallback: same `movement_family` + `exerciseMeetsEquipment()`
- Applies to all **planned** workouts from today through +14 days

### Nutrition preference engine

`backend/src/lib/nutritionPreferenceEngine.ts`

- Allergy/diet rules (nut, dairy, vegan, vegetarian, gluten, halal/kosher)
- Food preference biasing (chicken, fish, beef, eggs)
- Meal schedule metadata (`mealsPerDay`, `preferredWorkoutTimes`) stored on profile
- Updates **planned** (unlogged) meals in the next 14 days

### Orchestrator

`backend/src/lib/preferenceAdaptation.ts` → `adaptToPreferenceChanges(userId, trigger)`

| Trigger | Actions |
|---------|---------|
| `equipment` | Rewrite planned workout exercises |
| `nutrition` | Rewrite planned meal names + schedule notes |
| `all` | Both |

Returns `PreferenceAdaptationReport` with swap lists + notification copy.

### API

`POST /api/training/preferences/adapt`  
Body: `{ userId, trigger: 'equipment' | 'nutrition' | 'all' }`

### Client surfaces

| Surface | Behavior |
|---------|----------|
| Settings → Gym equipment | Save → instant adaptation + alert |
| Settings → Nutrition preferences | New editor → save → instant meal adaptation |
| `AdaptationNotice` | In-app summary of swaps |

---

## Acceptance criteria

| Criterion | Status |
|-----------|--------|
| Equipment updates instantly | **Yes** — on equipment save |
| Meal preferences update instantly | **Yes** — on nutrition prefs save |
| Workouts adapt automatically | **Yes** — planned workouts rewritten |
| Meals adapt automatically | **Yes** — planned meals rewritten |

---

## Validation

```bash
npm run validate:sprint7-adaptation
```

Unit tests:
- `backend/src/lib/equipmentSubstitutionEngine.test.ts`
- `backend/src/lib/nutritionPreferenceEngine.test.ts`

---

## Known limits

- Completed/logged meals and in-progress workouts are not retroactively changed
- Active session exercises require manual edit or next planned workout update
- Backend must be deployed for production API adaptation (Render)
