# Sprint 10 — Launch Recommendation

**Date:** 2026-06-10  
**Product:** ONE MORE  
**Recommendation:** **CONDITIONAL GO** — private beta first, public launch after P0 polish + beta validation

---

## Summary

| Launch type | Recommendation | Confidence |
|-------------|----------------|------------|
| **Public App Store launch** | **NOT YET** | High |
| **TestFlight closed beta (Sprint 9)** | **GO NOW** | High |
| **Public launch after Sprint 10 Batch A–C + beta** | **GO** | Medium |

ONE MORE has strong engineering depth (coaching engine, recovery intelligence, adaptation, beta ops) but **presentation and navigation polish lag the Home dashboard standard**. Shipping publicly today would expose dead-end loading states, buried recovery check-in, and coach UX flicker — friction that undermines the premium, coach-driven positioning.

---

## Scoring vs acceptance criteria

| Criterion | Status | Blocker? |
|-----------|--------|----------|
| No obvious UX friction | **FAIL** — 6 P0 workout/coach/recovery items | Yes |
| Visual consistency | **PARTIAL** — two-tier card system | Yes for premium claim |
| Premium presentation | **PARTIAL** — dashboard yes, tabs no | Yes for marketing |
| Production-ready quality | **PARTIAL** — backend ready, UX not | Yes |

**Overall polish: 66/100** (see [SPRINT10_FINAL_AUDIT.md](./SPRINT10_FINAL_AUDIT.md))

---

## What is production-ready today

| Area | Ready | Notes |
|------|-------|-------|
| Backend API | ✓ | Coaching, recovery, adaptation, beta feedback |
| Crash reporting | ✓ | Sentry mobile + backend |
| Subscription / Pro gating | ✓ | RevenueCat + beta override |
| TestFlight pipeline | ✓ | Preflight 7/7, EAS profiles |
| Beta ops | ✓ | Invites, feedback taxonomy, daily reports |
| Home dashboard | ✓ | Skeletons, honest recovery, premium cards |
| Active workout core | ✓ | Logging, supersets, rest timer work |
| AI prescription engine | ✓ | Sprint 8 unified coach |

---

## What blocks public launch

### Must fix (P0) — ~2 days

1. **Dead-end spinners** — workout day + summary routes
2. **Coach card flicker** — refetch on every set undermines in-session UX
3. **Silent coach failures** — prescription disappears without fallback
4. **Home recovery card** — not tappable; ring always green
5. **Coaching tab paywall-on-API-fail** — erodes Pro user trust
6. **Units bug** — summary weights in kg for imperial users

### Should fix before marketing push (P1) — ~2–3 days

7. Hidden Coaching tab as only intelligence hub
8. Nutrition tab visual parity + error states
9. Intelligence empty states
10. Navigation consolidation (Settings + Home entry points)

### Validate with real users (Sprint 9) — ~2 weeks

11. 10+ testers across 5 personas
12. Feedback triaged; P0/P1 in fix roadmap
13. Wave 1 authorization before scale

---

## Recommended launch sequence

```
┌─────────────────────────────────────────────────────────────┐
│  NOW: Sprint 9 closed beta (Build 195+)                     │
│  · Ship current TestFlight RC to 10–12 internal testers     │
│  · Collect categorized feedback                             │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  PARALLEL: Sprint 10 Batch A + B + C (2–3 eng days)         │
│  · Dead ends, coach polish, recovery discoverability        │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  RC BUILD: Sprint 10 polish (Build 196+)                    │
│  · Re-test with beta cohort                                 │
│  · Zero open P0 in triage                                   │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Sprint 10 Batch D + E (visual parity)                      │
│  · Optional for launch; required for premium marketing       │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  PUBLIC LAUNCH                                              │
│  · App Store submission                                     │
│  · Wave 2 beta → GA                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Go / no-go decision matrix

| Scenario | Decision |
|----------|----------|
| Ship TestFlight to 10 beta testers | **GO** |
| Ship public App Store this week | **NO-GO** |
| Ship public after Batch A–C + beta exit + zero P0 | **GO** |
| Ship public without beta | **NO-GO** (high confusion/recovery discovery risk) |
| Marketing "premium AI coach" campaign | **WAIT** until Batch B + E complete |

---

## Risk if launching prematurely

| Risk | Impact | Likelihood |
|------|--------|------------|
| Users hit infinite spinner on stale workout link | 1-star reviews | Medium |
| Pro users see paywall when coach API slow | Churn, support tickets | Medium |
| Recovery check-in undiscoverable | "App doesn't track recovery" | High |
| Coach flicker during sets | "Feels buggy" | High |
| Nutrition tab feels beta vs polished Home | Brand disconnect | High |

---

## Marketing readiness

| Message | Supported today? |
|---------|------------------|
| "AI coach tells you what to lift" | ✓ Active workout prescription |
| "Recovery-aware training" | △ Engine yes; UX discoverability no |
| "Premium training experience" | △ Dashboard yes; full app inconsistent |
| "Complete nutrition coaching" | △ Functional; visual polish needed |

**Recommendation:** Lead marketing with **workout + coach prescription** after Batch B. Hold recovery/nutrition hero claims until Batch C + E.

---

## Approval gates

| Gate | Owner | Status |
|------|-------|--------|
| Sprint 10 audit reviewed | Founder | ☐ |
| Batch A–C implementation approved | Engineering | ☐ |
| Sprint 9 beta complete | Ops | ☐ |
| Public launch build approved | Founder | ☐ |

---

## Next actions

1. **Founder:** Approve Sprint 9 beta build (`build it`) if not already shipped
2. **Engineering:** Implement Batch A → B → C from [SPRINT10_PRODUCTION_CHECKLIST.md](./SPRINT10_PRODUCTION_CHECKLIST.md)
3. **Ops:** Run beta per [SPRINT9_PRIVATE_BETA_PLAN.md](./SPRINT9_PRIVATE_BETA_PLAN.md)
4. **Founder:** Re-evaluate public launch after beta + Batch A–C sign-off

**No public launch build until explicit approval after above steps.**

---

## Related documents

| Doc | Purpose |
|-----|---------|
| [SPRINT10_FINAL_AUDIT.md](./SPRINT10_FINAL_AUDIT.md) | Full findings |
| [SPRINT10_PRODUCTION_CHECKLIST.md](./SPRINT10_PRODUCTION_CHECKLIST.md) | Fix checklist |
| [SPRINT9_PRIVATE_BETA_PLAN.md](./SPRINT9_PRIVATE_BETA_PLAN.md) | Beta execution |
| [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) | Infra release steps |
