# Sprint 11 — Transformation Engine Redesign

**Objective:** Turn Progress into the most motivating screen in ONE MORE — a story, not a spreadsheet.

---

## What changed

### Story engine (`src/lib/transformation/transformationStory.ts`)

Computes from projection + measurement history:

| Output | Answers |
|--------|---------|
| `progressPercent` | Where am I? |
| `goalWeightKg` / `goalBodyFatPct` | Where am I going? |
| `daysRemaining` / `estimatedCompletionDate` | How long will it take? |
| `scheduleLabel` (Ahead / On track / Behind) | Am I on track? |
| `coachInsights[]` | Coach-driven narrative |
| `milestones[]` | BF % gates (20→10) with estimated dates |

### Progress screen redesign (`src/app/(tabs)/progress.tsx`)

**Story-first layout:**

1. **TransformationStoryHero** — current/goal weight & BF, days remaining, completion date
2. **CoachProjectionCard** — current → goal, required fat loss, pace, status
3. **TransformationProgressTimeline** — START — CURRENT — GOAL bar
4. **CoachInsightsPanel** — narrative bullets
5. **TransformationMilestones** — 20/18/15/12/10% with dates
6. **PhotoProgressGuide** — front/side/back capture + comparison slider
7. **BodyCompositionSummary** — single unit system for lean/fat mass
8. Collapsible measurement log (secondary)

### Body composition units

Lean mass and fat mass now use `formatWeight()` — if the user prefers pounds, all mass values display in **lb** (no mixed kg/lb).

---

## Acceptance criteria

| Criterion | Status |
|-----------|--------|
| Goal timeline visible | ✓ Hero + CoachProjectionCard |
| Body composition one unit system | ✓ `formatMassFromKg` |
| Coach explains progress | ✓ CoachInsightsPanel |
| Milestones visible | ✓ TransformationMilestones |
| Photo comparisons functional | ✓ PhotoProgressGuide + slider |
| User understands path to goal | ✓ Story copy + projection card |

---

## Validation

```bash
npm run validate:sprint11-transformation
```

Regression: `npm run validate:sprint82`

---

## Follow-ups (post-Sprint 11)

- Auto-refresh projection after new measurement
- Voice: "Show my transformation" → Progress tab
- Link Home dashboard progress card → this screen
- Deprecate unused `TransformationDashboard.tsx` or merge comparison modes into PhotoProgressGuide
