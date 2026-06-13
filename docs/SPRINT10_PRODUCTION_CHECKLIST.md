# Sprint 10 — Production Checklist

Use this checklist to close the gap between **66/100** polish score and production-ready launch.  
Check items off as implemented; re-run `npm run validate:sprint10-production-polish` after each batch.

**Do not ship public App Store build until Batch A + B + C are complete and Sprint 9 beta exit criteria met.**

---

## Pre-flight

- [ ] Sprint 8 coaching routes deployed to Render
- [ ] Sprint 9 migration 019 applied (`npm run migrate:019`)
- [ ] `npm run validate:sprint9-private-beta` — beta program ready
- [ ] `npm run validate:sprint10-production-polish` — docs + regression gate

---

## Batch A — Dead ends & error states (P0)

### Workout routes

- [ ] **W-P0-1** `day.tsx`: distinguish loading vs not-found vs fetch error
  - [ ] Show error Card with "Workout not found" + back to weekly plan
  - [ ] Do not spin forever when `!workout && !loading`
- [ ] **W-P0-2** `summary.tsx`: error/empty screen when session load fails
  - [ ] Replace infinite spinner with retry + navigate home

### Intelligence screens

- [ ] **N-P1-5** `nutrition-intelligence.tsx`: empty state when report is null
- [ ] **R-P1-3** `recovery-analysis.tsx`: empty state when report is null
  - [ ] Card: "Complete a check-in to unlock intelligence" + CTA

### Shared primitives (recommended)

- [ ] Create `EmptyStateCard` (icon, title, body, optional CTA)
- [ ] Create `ErrorStateCard` (message, retry)
- [ ] Use in workout day, summary, intelligence screens

---

## Batch B — Coach-driven feel (P0 + P1)

### Active workout

- [ ] **W-P0-3** Debounce or stabilize `ExerciseCoachCard` refetch
  - [ ] Do not show full loading state on every set log
  - [ ] Option: refetch only when exercise changes or on explicit refresh
- [ ] **W-P0-4** Coach failure fallback UI
  - [ ] Show plan defaults + "Coach unavailable — using plan targets" + retry
- [ ] **C-P1-6** Timed exercises: show compact coach note (sets/duration) or hide gracefully with copy

### Coaching tab

- [ ] **C-P0-1** Distinguish API failure vs paywall in `coaching.tsx`
  - [ ] Pro users: show error/retry, not `UpgradePrompt`
  - [ ] Free users: keep paywall
- [ ] **C-P1-3** Unify coach loading copy → "Coach analyzing…"
- [ ] **C-P1-4** Smart questions: loading indicator on answer card

### Post-workout

- [ ] **C-P1-5** Post-workout coach summary: loading skeleton + retry button

### Cleanup

- [ ] **W-P1-3** Remove or deprecate orphaned `SmartProgressionCard` (if fully replaced by `ExerciseCoachCard`)

---

## Batch C — Recovery & readiness discoverability (P0)

- [ ] **R-P0-1** Make Home recovery card tappable
  - [ ] Navigate to recovery check-in (no score) or recovery intelligence (has score)
- [ ] **R-P0-2** Dynamic ring color by recovery score/status
  - [ ] Use `statusColorKey` or score thresholds (green ≥80, amber 55–79, red &lt;55)
- [ ] **R-P1-1** Add "Daily check-in" to Settings → Training (or Home recovery CTA)
- [ ] **RD-P1-1** Show Readiness % on Home recovery card (from intelligence or placeholder)

### Naming

- [ ] **R-P1-4** Standardize on **"Recovery Intelligence"** everywhere

---

## Batch D — Navigation & organization (P0 + P1)

- [ ] **C-P0-2** Resolve hidden Coaching tab dependency
  - [ ] Option A: Re-enable Coaching tab in tab bar
  - [ ] Option B: Move intelligence links to Home + Settings hub cards
  - [ ] Minimum: Settings "Training Experience" → clear labels, not surprise routing
- [ ] **N-P1-3** Nutrition tab: prominent Intelligence card (not bottom caption)
- [ ] **N-P1-6** Nutrition tab: link to Preferences
- [ ] Group coaching shortcuts into Cards (Recovery / Training / Nutrition) vs 7-button stack

---

## Batch E — Visual consistency & premium presentation (P1)

### Nutrition

- [ ] **N-P1-1** Pull-to-refresh + skeleton loading on Nutrition tab
- [ ] **N-P1-2** Upgrade `NutritionProgressHeader` — macro rings or progress bars
- [ ] **N-P0-1** Explicit error state when goals/summary load fails
- [ ] **P2** `MealPlanCard` glow/gradient parity with dashboard cards

### Workout

- [ ] **W-P1-1** Unify rest presets (hero + overlay same set)
- [ ] **W-P1-2** Weekly plan: skeleton + empty state Card
- [ ] **W-P1-6** Day overview: collapse coach `detailedReason` by default (compact mode)
- [ ] Theme pass: replace hardcoded hero gradients with `LiftFlowColors.gradientStart/End`

### Recovery

- [ ] **R-P1-2** Check-in initial loading skeleton
- [ ] Dashboard recovery card: `glow` + tappable — already has glow

### Shared

- [ ] Port `SkeletonBlock` pattern to workout, nutrition, coaching tabs
- [ ] Replace hardcoded success badge rgba with theme token (`successGlow`)
- [ ] Modal overlays → `LiftFlowColors.overlay`

---

## Batch F — Copy, units & data honesty (P0 + P1)

- [ ] **W-P0-5** `WorkoutSummaryScreen`: use `useUnits()` for weight display
- [ ] **W-P0-6** `WorkoutCard`: use actual rep range from exercise/plan
- [ ] **W-P1-5** Rename "Manual Log (fallback)" → "Quick log" or "Log without plan"
- [ ] **N-P1-4** Meal alternatives: badge "Offline suggestions" + retry when API fails
- [ ] **N-P0-2** Separate meal detail view from replace sheet (tap vs long-press or explicit Replace button)

---

## Batch G — Typography & hierarchy (P2)

- [ ] Standardize tab screen titles: `headline` vs `title` decision documented in theme
- [ ] Remove forced `.toUpperCase()` on exercise names in active workout
- [ ] SetLoggingControls / RestTimerOverlay: align with `metric` / `display` variants
- [ ] Recovery trend chart: minimum 11px labels

---

## Acceptance criteria verification

| Criterion | Check |
|-----------|-------|
| **No obvious UX friction** | All Batch A + B + C items checked |
| **Visual consistency** | Batch E theme pass complete; spot-check 5 screens |
| **Premium presentation** | Nutrition header + dashboard parity; no flat spinner-only tabs |
| **Production-ready quality** | Sprint 9 beta complete; zero open P0 in triage |

---

## Regression gates (run before launch build)

```bash
npm run validate:sprint10-production-polish
npm run validate:sprint9-private-beta
npm run validate:sprint8-coaching
npm run validate:sprint87
npm run build:testflight-rc -- --dry-run
```

---

## Sign-off

| Role | Name | Date | Batch A–F complete |
|------|------|------|-------------------|
| Engineering | | | ☐ |
| Design / UX | | | ☐ |
| Founder | | | ☐ |

**Approved for public launch build:** ☐ Yes · ☐ No — see [SPRINT10_LAUNCH_RECOMMENDATION.md](./SPRINT10_LAUNCH_RECOMMENDATION.md)
