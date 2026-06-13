# Sprint 10 — Final Production Polish Audit

**Product:** ONE MORE (LiftFlow)  
**Date:** 2026-06-10  
**Scope:** Workout · Nutrition · Recovery · Readiness · AI Coaching · Loading/empty states · Typography · Cards · Visual hierarchy  
**Build:** Not started — awaiting founder approval

---

## Executive summary

| Dimension | Score | Verdict |
|-----------|-------|---------|
| **Workout UX** | 72/100 | Strong core flow; dead-end loading and coach flicker block premium feel |
| **Nutrition UX** | 65/100 | Functional but flat vs dashboard; weak progress visualization |
| **Recovery UX** | 68/100 | Intelligence screens solid; check-in buried, ring color misleading |
| **Readiness UX** | 58/100 | Exists only inside Recovery Intelligence — no dedicated surface |
| **AI Coaching** | 70/100 | Rich backend; hidden tab hub, paywall-on-failure, button clutter |
| **Loading states** | 62/100 | Dashboard has skeletons; workout/nutrition/recovery mostly spinners |
| **Empty states** | 55/100 | Inconsistent; several infinite-spinner dead ends |
| **Typography** | 78/100 | `AppText` system is good; tab vs feature screen title drift |
| **Card design** | 70/100 | Two-tier system — gradient heroes vs flat feature cards |
| **Visual hierarchy** | 66/100 | Home is premium reference; secondary tabs don't match |

**Overall production polish score: 66/100**

**Acceptance criteria status:**

| Criterion | Met? |
|-----------|------|
| No obvious UX friction | ✗ — P0 dead ends, coach flicker, buried recovery |
| Visual consistency | ✗ — gradient vs flat cards, title variants, hardcoded colors |
| Premium presentation | △ — Home/dashboard yes; Nutrition/Recovery/Workout secondary screens lag |
| Production-ready quality | ✗ — Fix P0 batch before public launch |

---

## 1. Workout UX

### Strengths
- Clear flow: weekly plan → day overview → active session → summary
- Superset support, rest overlay, set logging modes (weighted/bodyweight/timed)
- `ExerciseCoachCard` integrated inline during active workout (Sprint 8)
- Session resume via `WorkoutSessionContext`

### P0 — Friction

| ID | Issue | Location |
|----|-------|----------|
| W-P0-1 | Invalid/missing workout ID → **infinite spinner** (no error, no back) | `src/app/(tabs)/workout/day.tsx` |
| W-P0-2 | Failed summary load → **infinite spinner** after Alert | `src/app/(tabs)/workout/summary.tsx` |
| W-P0-3 | Coach card **refetches every logged set** → "Coach analyzing…" flicker | `ExerciseCoachCard.tsx` + `ActiveWorkoutScreen.tsx` |
| W-P0-4 | Coach API failure → **silent null** (block disappears) | `ExerciseCoachCard.tsx` |
| W-P0-5 | Summary exercise breakdown shows **hardcoded kg** (ignores units) | `WorkoutSummaryScreen.tsx` |
| W-P0-6 | `WorkoutCard` shows hardcoded **4–6 rep suggestion** | `WorkoutCard.tsx` |

### P1 — Polish

| ID | Issue | Location |
|----|-------|----------|
| W-P1-1 | Rest presets mismatch: hero `[60–150]` vs overlay adds `180` | `ActiveWorkoutScreen.tsx`, `RestTimerOverlay.tsx` |
| W-P1-2 | Weekly plan: text-only loading, no empty/error state | `WorkoutWeeklyPlanScreen.tsx` |
| W-P1-3 | `SmartProgressionCard` orphaned (dead code); duplicate coach service | `SmartProgressionCard.tsx` |
| W-P1-4 | Manual log auto-starts session on mount | `manual-log.tsx` |
| W-P1-5 | "Manual Log (fallback)" — internal copy | `WorkoutWeeklyPlanScreen.tsx` |
| W-P1-6 | Day overview coach text dense on 6+ exercise days | `WorkoutExerciseDetailList.tsx` |

### P2 — Nice-to-have
- Skeleton loaders in weekly plan (port `SkeletonBlock` from dashboard)
- Collapsible coach reasoning in hero card
- Shared hero gradient component vs hardcoded `rgba(31, 107, 255, …)`

---

## 2. Nutrition UX

### Strengths
- Today / Week / Shopping tabs with meal plan generation
- Meal replace flow with advisory API
- Nutrition intelligence dashboard (macros, grocery, hydration signals)
- Preferences editor with adaptation hook (Sprint 7)

### P0 — Friction

| ID | Issue | Location |
|----|-------|----------|
| N-P0-1 | Load failures **silent** — may show empty "Generate plan" incorrectly | `nutrition/index.tsx` |
| N-P0-2 | Meal tap opens **replace sheet**, not read-only detail — confusing intent | `nutrition/index.tsx`, `MealReplaceSheet.tsx` |

### P1 — Polish

| ID | Issue | Location |
|----|-------|----------|
| N-P1-1 | Full-screen spinner only — no skeleton, no pull-to-refresh | `nutrition/index.tsx` |
| N-P1-2 | `NutritionProgressHeader` is one text line — no rings/bars vs dashboard | `NutritionProgressHeader.tsx` |
| N-P1-3 | Intelligence link buried at bottom caption | `nutrition/index.tsx` |
| N-P1-4 | Local meal fallback visible when API fails ("on-device suggestions") | `nutritionAdvisoryService.ts` |
| N-P1-5 | Intelligence screen: **no empty state** when `report === null` | `nutrition-intelligence.tsx` |
| N-P1-6 | No preferences entry from Nutrition tab (Settings only) | `nutrition/index.tsx` |

### P2 — Nice-to-have
- Week tab empty state Card
- Shopping list generate loading indicator
- `MealPlanCard` gradient/glow to match `HomeNextUpCard`

---

## 3. Recovery UX

### Strengths
- Recovery intelligence engine with transparency payload (Sprint 6)
- "How this score works" UI on intelligence dashboard
- Honest empty state on dashboard (no fake 88/72/65 fallbacks)
- Check-in form with trend chart

### P0 — Friction

| ID | Issue | Location |
|----|-------|----------|
| R-P0-1 | **Home recovery card not tappable** — CTA "Check in for your score" goes nowhere | `dashboard.tsx` |
| R-P0-2 | Recovery ring **always green** regardless of score | `dashboard.tsx` + `RingGauge` |

### P1 — Polish

| ID | Issue | Location |
|----|-------|----------|
| R-P1-1 | Check-in only reachable via **hidden Coaching tab** or Settings | `coaching.tsx`, `settings.tsx` |
| R-P1-2 | Check-in: no initial loading; score flickers from `—` | `recovery-check-in.tsx` |
| R-P1-3 | Recovery intelligence: **no empty state** when report null | `recovery-analysis.tsx` |
| R-P1-4 | Naming drift: "Recovery Intelligence" / "Recovery Dashboard" / "Recovery Analysis" | Multiple screens |
| R-P1-5 | Muscle map is text grid, not body diagram | `MuscleRecoveryHeatMap.tsx` |
| R-P1-6 | Compact coaching tab hides muscle map, trend, transparency | `coaching.tsx` |

### P2 — Nice-to-have
- Sliders/steppers instead of raw TextInput for 1–10 scales
- Inline success confirmation vs Alert on check-in submit

---

## 4. Readiness UX

### Current state
Readiness exists as **muscle readiness score** inside Recovery Intelligence (`factors.muscleReadinessScore`, transparency copy). There is **no dedicated Readiness screen, tab, or Home card**.

| ID | Issue | Severity |
|----|-------|----------|
| RD-P1-1 | Readiness not surfaced on Home alongside Recovery % | High |
| RD-P1-2 | No link from workout/coach surfaces to readiness context | Medium |
| RD-P2-1 | No standalone readiness check-in or explainer | Low |

**Recommendation:** Add Readiness as labeled sub-metric on Home recovery card and in active workout coach context (already partially in `ExerciseCoachCard`).

---

## 5. AI Coaching

### Strengths
- Unified exercise prescription (Sprint 8): sets, weight, reasoning, why-selected
- Workout recommendations panel
- Conversational coach chat
- Post-workout coach summary hook

### P0 — Friction

| ID | Issue | Location |
|----|-------|----------|
| C-P0-1 | Coaching tab shows **UpgradePrompt when API returns null** — even for Pro users | `coaching.tsx` L175–197 |
| C-P0-2 | **Coaching tab hidden** (`href: null`) but remains primary hub for 7+ features | `_layout.tsx`, `coaching.tsx` |

### P1 — Polish

| ID | Issue | Location |
|----|-------|----------|
| C-P1-1 | Seven full-width secondary buttons — weak hierarchy | `coaching.tsx` |
| C-P1-2 | Generated workout/meals shown as Alert + footnote text | `coaching.tsx` |
| C-P1-3 | Coach copy inconsistency ("Coach analyzing…" / "Loading coach target…") | Multiple components |
| C-P1-4 | Smart questions: no loading on answer card | `coaching.tsx` |
| C-P1-5 | Post-workout coach summary: no retry if null | `summary.tsx`, `WorkoutSummaryScreen.tsx` |
| C-P1-6 | No coach for timed exercises in active workout | `ActiveWorkoutScreen.tsx` |

---

## 6. Loading states

| Surface | Pattern | Premium? |
|---------|---------|----------|
| Dashboard | `SkeletonBlock` + animated cards | ✓ Reference |
| Workout tab | Spinner (size inconsistent) | ✗ |
| Workout day route | Spinner → infinite on miss | ✗ |
| Nutrition tab | Full-screen blocking spinner | ✗ |
| Recovery check-in | None on mount | ✗ |
| Intelligence screens | Center spinner | △ |
| ExerciseCoachCard | Inline spinner per refetch | ✗ (flicker) |
| Coaching tab | Full-screen spinner | △ |

**Gap:** No shared `LoadingState` / `ErrorState` / `EmptyState` primitives used app-wide.

---

## 7. Empty states

| Surface | Empty handling | Issue |
|---------|----------------|-------|
| Weekly plan | None | Shows rest days without explanation |
| Day overview | Assumes exercises exist | No zero-exercise card |
| Nutrition today | Card + CTA | Good |
| Nutrition week | Bare button | Weak |
| Intelligence (both) | Missing when null | Blank screen |
| Workout summary | Spinner forever on fail | Dead end |
| Coaching recommendations | Plain text | No Card + CTA |
| Workout edit | No guidance | Only "+ Add Exercise" |

---

## 8. Typography

### System (`AppText` + `theme.ts`)
- **Strong:** Sora hero, Inter body/header, Manrope labels, `metric` variant for scores
- **Consistent tokens:** `hero`, `title`, `headline`, `body`, `footnote`, `caption`, `label`

### Drift
| Issue | Example |
|-------|---------|
| Tab screens use `headline`; feature screens use `title` | Nutrition tab vs nutrition-intelligence |
| Exercise name forced `.toUpperCase()` on `headline` | ActiveWorkoutScreen |
| Numeric inputs bypass typography (`fontSize: 22`, timer `56`) | SetLoggingControls, RestTimerOverlay |
| 9px trend chart labels | RecoveryTrendChart |

---

## 9. Card design & visual hierarchy

### Two-tier system (problem)

| Tier | Where | Treatment |
|------|-------|-------------|
| **Premium** | Dashboard, HomeNextUpCard, AI Coach card | `LinearGradient` border, `glow`, animated entry |
| **Standard** | Nutrition meals, intelligence dashboards, day overview | Flat `Card`, no glow |

### Hardcoded colors (should use theme)

| Pattern | Files |
|---------|-------|
| `rgba(31, 107, 255, …)` hero gradients | ActiveWorkoutScreen, WorkoutSummaryScreen |
| `rgba(0, 229, 168, 0.12)` success badges | ExerciseCompleteCard, WorkoutSummaryScreen |
| Fixed green recovery ring | dashboard.tsx |
| Modal backdrops `rgba(0,0,0,0.6)` | SetEditModal, VoiceConfirmModal |

### Positive reference
Use `src/app/(tabs)/dashboard.tsx` as the visual bar: skeleton loading, glow cards, gradient heroes, honest empty copy, animated sections.

---

## 10. Cross-cutting friction matrix

```
                    Loading   Empty    Error    Premium feel
Dashboard             ✓        ✓        △          ✓
Workout               △        ✗        ✗          △
Nutrition             ✗        △        ✗          ✗
Recovery              ✗        △        △          △
Coaching (hidden)     △        △        ✗          △
```

---

## 11. Recommended fix batches

See [SPRINT10_PRODUCTION_CHECKLIST.md](./SPRINT10_PRODUCTION_CHECKLIST.md) for full checklist.

| Batch | Focus | Est. effort | Unblocks |
|-------|-------|-------------|----------|
| **A — Dead ends** | day.tsx, summary.tsx error/empty screens | 0.5 day | Trust |
| **B — Coach polish** | Debounce coach refetch, failure fallback, paywall fix | 1 day | Coach-driven feel |
| **C — Recovery discoverability** | Tappable Home card, ring color, check-in entry | 0.5 day | Recovery UX |
| **D — Navigation** | Surface intelligence from Home/Nutrition/Settings; reduce hidden tab dependency | 1 day | Organization |
| **E — Visual parity** | Nutrition progress header, shared empty/loading primitives, theme pass | 1–2 days | Premium presentation |
| **F — Copy & units** | Summary kg fix, WorkoutCard reps, consumer copy | 0.5 day | Polish |

**Total estimated polish sprint:** 4–5 engineering days before public launch.

---

## 12. Files audited (index)

| Area | Key paths |
|------|-----------|
| Workout | `src/app/(tabs)/workout/`, `src/components/workout/` |
| Nutrition | `src/app/(tabs)/nutrition/`, `src/components/nutrition/` |
| Recovery | `src/app/(features)/recovery-*`, `src/components/recovery/` |
| Coaching | `src/app/(tabs)/coaching.tsx`, `ExerciseCoachCard.tsx` |
| Dashboard | `src/app/(tabs)/dashboard.tsx`, `src/components/dashboard/` |
| Design system | `src/constants/theme.ts`, `AppText.tsx`, `Card.tsx` |

---

## Related docs

- [SPRINT10_PRODUCTION_CHECKLIST.md](./SPRINT10_PRODUCTION_CHECKLIST.md)
- [SPRINT10_LAUNCH_RECOMMENDATION.md](./SPRINT10_LAUNCH_RECOMMENDATION.md)
- [SPRINT9_PRIVATE_BETA_PLAN.md](./SPRINT9_PRIVATE_BETA_PLAN.md) — run beta before public launch
