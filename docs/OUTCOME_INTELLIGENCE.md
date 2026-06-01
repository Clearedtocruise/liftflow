# LiftFlow Outcome Intelligence (Sprint 6.0 Phase 1)

Measure outcomes, not activity.

## Schema (Migration 011)

| Table | Purpose |
|-------|---------|
| `user_outcome_baselines` | Starting point at coach activation (one row per user) |
| `user_outcome_snapshots` | Periodic current state + deltas |
| `user_success_scores` | Composite 0–100 success score + category |
| `user_risk_flags` | At-risk signals + coaching messages |
| `population_outcome_aggregates` | Anonymous company-wide KPIs |
| `outcome_cohort_signals` | AI learning foundation (no ML yet) |

Goals extended with `completion_pct`, `projected_completion_date`, `velocity`, `baseline_value`.

## Outcome Engine Architecture

```
coachActivation()
    └── captureOutcomeBaseline()     # onboarding complete

Cron / POST /api/outcome/compute
    └── runOutcomeEngineForAllUsers()
            ├── computeUserOutcome(userId)
            │     ├── collectCurrentMetrics()
            │     ├── computeAdherence()        # workouts + protein
            │     ├── updateGoalAchievement()   # completion %, velocity, projected date
            │     ├── upsert user_outcome_snapshots
            │     ├── upsert user_success_scores
            │     └── detectRiskFlags() → user_risk_flags
            ├── computePopulationAggregates()
            └── computeCohortSignals()
```

Source: `backend/src/lib/outcomeEngine.ts`

## Success Score Formula

Weighted composite (0–100):

| Factor | Weight |
|--------|--------|
| Workout adherence | 25% |
| Nutrition adherence | 20% |
| Recovery compliance | 15% |
| Goal progress | 20% |
| Strength progress | 10% |
| Weight progress | 10% |

Categories:

- **90–100** → Exceptional
- **75–89** → Good
- **60–74** → Needs Attention
- **Below 60** → At Risk

## Lives Improved Formula

A user qualifies when **any** of:

1. `overall_score >= 75`
2. Active goal reached (`completion_pct >= 100` or status `completed`)
3. Sustained positive trend over 12 weeks (≥70% of weekly snapshots show improvement in weight, strength, or recovery deltas)

Stored in `user_success_scores.life_improved` and rolled up to `population_outcome_aggregates.lives_improved_count`.

## Founder Dashboard (Sprint 6.1)

Full dashboard at `GET /admin/founder` with Chart.js visualizations.

| Section | Metrics |
|---------|---------|
| Company Health | Total/active/paying users, retention, churn |
| Outcome Health | Lives improved, goals achieved, lbs lost, strength, recovery |
| User Success | Score/goal/adherence distributions |
| Risk Dashboard | At-risk count, top reasons, intervention list |
| Goal Analytics | Most/least successful goals, avg completion time |
| Behavior Analytics | Success/failure correlations from cohort data |
| Founder Insights | Evidence-based + optional OpenAI strategic summaries |

Source: `backend/src/lib/founderDashboard.ts`

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/outcome/compute` | Founder key | Batch compute all users |
| POST | `/api/outcome/compute/:userId` | Founder key | Single user compute |
| GET | `/api/outcome/user/me` | Bearer token | User's outcome summary |
| GET | `/api/outcome/user/:userId` | Founder key | Any user summary |
| GET | `/api/founder/dashboard` | Founder key | Population + founder Q&A |
| POST | `/api/founder/refresh` | Founder key | Recompute + dashboard |
| GET | `/admin/founder` | Public HTML | Founder dashboard UI |

## Goal Achievement Engine

For each active goal:

- `completion_pct = min(100, current_value / target_value × 100)`
- `velocity = (current_value - baseline_value) / weeks_since_created`
- `projected_completion_date = today + (remaining / velocity)` when velocity > 0

Example: Lose 40 lb, 18 lb lost → 45%. At 1.5 lb/week → projected ~15 weeks out.

## Population Analytics

Daily row in `population_outcome_aggregates`:

- Total / active / paying users
- Total pounds lost & muscle-gain proxy
- Workouts completed, hours trained
- Average weight loss, strength increase, recovery improvement
- Average goal completion, adherence, success score
- Lives improved count, 30-day retention
- Goal success/failure rates by type

## AI Learning Foundation

`outcome_cohort_signals` stores cohort snapshots (`successful`, `unsuccessful`, `at_risk`, `all`) with adherence averages and `behavior_patterns` JSON for future pattern analysis. No recommendation model is trained in Phase 1.
