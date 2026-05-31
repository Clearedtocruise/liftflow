# Sprint 8.7 — Internal Soak Tracker

Track each internal tester through the soak plan. Target: **5–10 testers** with `LIFTFLOW-INTERNAL`.

**Invite:** Settings → Beta Access → `LIFTFLOW-INTERNAL`  
**Build:** TestFlight only (not Expo Go)

---

## Tester roster

| # | Name | Device | Invite redeemed | Installed TF | Owner |
|---|------|--------|-----------------|--------------|-------|
| 1 | | | ☐ | ☐ | |
| 2 | | | ☐ | ☐ | |
| 3 | | | ☐ | ☐ | |
| 4 | | | ☐ | ☐ | |
| 5 | | | ☐ | ☐ | |
| 6 | | | ☐ | ☐ | |
| 7 | | | ☐ | ☐ | |
| 8 | | | ☐ | ☐ | |
| 9 | | | ☐ | ☐ | |
| 10 | | | ☐ | ☐ | |

---

## Soak checklist (per tester)

| Flow | Tester 1 | Tester 2 | Tester 3 | Tester 4 | Tester 5+ |
|------|----------|----------|----------|----------|-----------|
| Login / signup | ☐ | ☐ | ☐ | ☐ | ☐ |
| Onboarding | ☐ | ☐ | ☐ | ☐ | ☐ |
| Workout logging (3+ sets) | ☐ | ☐ | ☐ | ☐ | ☐ |
| Voice logging | ☐ | ☐ | ☐ | ☐ | ☐ |
| AI Coach | ☐ | ☐ | ☐ | ☐ | ☐ |
| Recovery intelligence | ☐ | ☐ | ☐ | ☐ | ☐ |
| Nutrition intelligence | ☐ | ☐ | ☐ | ☐ | ☐ |
| Transformation Engine | ☐ | ☐ | ☐ | ☐ | ☐ |
| Peak Music Sync | ☐ | ☐ | ☐ | ☐ | ☐ |
| RevenueCat (sandbox) | ☐ | ☐ | ☐ | ☐ | ☐ |
| HealthKit sync | ☐ | ☐ | ☐ | ☐ | ☐ |
| Apple Watch | ☐ | ☐ | ☐ | ☐ | ☐ |
| Submit feedback | ☐ | ☐ | ☐ | ☐ | ☐ |

---

## Issues log

| ID | Severity | Area | Description | Status |
|----|----------|------|-------------|--------|
| | P0/P1/P2 | | | open |

**P0:** ship blocker · **P1:** fix before Wave 1 · **P2:** acceptable with workaround

---

## Exit criteria (internal soak)

- [ ] 5–10 internal testers installed TestFlight build
- [ ] Zero **P0** issues open
- [ ] Zero **recurring P1** issues (same bug ≥2 testers)
- [ ] Core flows pass: login, workout, voice, coach, feedback
- [ ] Sentry receiving mobile events
- [ ] `npm run beta:daily-report` shows soak events > 0

**When complete:** see [SPRINT87_WAVE1_AUTHORIZATION.md](./SPRINT87_WAVE1_AUTHORIZATION.md)

---

## Daily automation

```bash
npm run beta:daily-report
```

Updates [SPRINT87_LAUNCH_BLOCKERS.md](./SPRINT87_LAUNCH_BLOCKERS.md) and `docs/reports/BETA_DAILY_*.md`
