# Sprint 8.7 — Authorization Brief

**Status:** **AUTHORIZED** — Sprint 8.6 PASS (56/56, zero P0/P1)

Sprint 8.6 delivered TestFlight RC readiness with backend + mobile Sentry, beta ops, and full validation. Sprint 8.7 executes **closed beta execution and soak**.

---

## Sprint 8.7 scope

| Priority | Deliverable |
|----------|-------------|
| 1 | Upload TestFlight RC + invite internal testers |
| 2 | Complete device testing matrix (SE, 13, 15, 16 Pro) |
| 3 | Sandbox IAP validation on TestFlight |
| 4 | 1-week internal soak (10 sessions/tester minimum) |
| 5 | Closed beta wave 1 — 25 users (`LIFTFLOW-BETA25`) |
| 6 | Weekly release notes + changelog cadence |
| 7 | Founder metrics review (DAU, retention, conversion) |

---

## Preconditions — satisfied

- [x] `npm run validate:sprint86` → **PASS** 56/56
- [x] `EXPO_PUBLIC_SENTRY_DSN` in EAS + `@sentry/react-native` installed
- [x] Backend Sentry live on Render
- [x] Beta invite codes seeded
- [x] Zero open P0/P1

---

## Success criteria (Sprint 8.7)

- TestFlight RC uploaded and processed
- 25 beta users onboarded with invite codes
- Crash-free rate >99% over 7 days
- No unresolved P0 bugs
- Feedback pipeline operational

---

## Recommended timeline

| Date | Milestone |
|------|-----------|
| 2026-06-02 | TestFlight RC upload |
| 2026-06-09 | Internal soak complete |
| 2026-06-14 | Closed beta wave 1 launch |

See [CLOSED_BETA_INTERNAL_TESTING_PLAN.md](./CLOSED_BETA_INTERNAL_TESTING_PLAN.md)

---

## Validator

```bash
npm run validate:sprint87   # 15/15 closed beta execution gate
npm run beta:daily-report   # Daily status + launch blockers
npm run build:testflight-rc # Preflight + EAS TestFlight build
```
