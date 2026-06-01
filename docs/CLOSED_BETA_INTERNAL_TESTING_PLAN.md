# Closed Beta — Internal Testing Plan (Sprint 8.6)

**Authorization:** **GRANTED** — Sprint 8.6 PASS (2026-05-31)  
**Duration:** 1 week internal soak → 2–3 weeks closed beta (25 users)

---

## Week 0 — TestFlight RC (founder team)

| Day | Activity | Owner |
|-----|----------|-------|
| D0 | Upload `npm run build:ios:testflight` | Founder |
| D0 | Internal testers install (5–8 people) | QA |
| D1–D3 | Run [TESTFLIGHT_INTERNAL_TESTING_CHECKLIST.md](./TESTFLIGHT_INTERNAL_TESTING_CHECKLIST.md) | All |
| D4–D5 | Triage feedback + Sentry issues | Founder |
| D6–D7 | RC fix build if any P0 | Eng |

**Exit criteria:** Zero P0, ≤2 P1 with workarounds, Sentry receiving mobile + backend events.

---

## Week 1 — Internal soak (10 testers)

- Redeem `LIFTFLOW-INTERNAL` in Settings → Beta Access
- Minimum 3 workouts logged per tester
- One voice session + one AI Coach session per tester
- Sandbox subscription test (2 testers)
- Device matrix: iPhone SE, 13, 15 ([DEVICE_TESTING_MATRIX.md](./DEVICE_TESTING_MATRIX.md))

---

## Weeks 2–3 — Closed beta (25 users)

- Invite wave 1: `LIFTFLOW-BETA25` (25 codes)
- Monitor founder dashboard `/api/founder` + Sentry daily
- Weekly release notes via in-app Release Notes screen
- Support SLA: [BETA_SUPPORT_PLAYBOOK.md](./BETA_SUPPORT_PLAYBOOK.md)

**Expand to 50:** After 2 weeks with zero P0 → `LIFTFLOW-BETA50`

---

## Metrics to watch

| Metric | Target (week 2) |
|--------|-------------------|
| Onboarding completion | >80% |
| Workout completion (7d) | >60% of active |
| Crash-free sessions | >99% |
| Feedback response | <24h triage |

---

## Rollback triggers

- P0 workout logging regression → pause invites
- Sentry crash spike >5% sessions → hotfix build
- API 500 rate >1% → incident response ([INCIDENT_RESPONSE_GUIDE.md](./INCIDENT_RESPONSE_GUIDE.md))
