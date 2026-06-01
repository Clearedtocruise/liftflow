# Beta Daily Status Report

**Date:** 2026-05-31  
**Phase:** Internal soak (Sprint 8.7)  
**P0:** 0 · **P1:** 4  
**Wave 1 (LIFTFLOW-BETA25):** **NOT AUTHORIZED**  
**Expand to 50:** Not yet

---

## Infrastructure

| System | Status |
|--------|--------|
| Render API | ✓ ok |
| OpenAI | configured |
| Supabase | configured |
| Backend Sentry | configured |

---

## Internal testers

| Metric | Value |
|--------|-------|
| Registered internal | 0 / 5–10 |
| LIFTFLOW-INTERNAL uses | 0 / 10 |
| Open feedback | 0 |

---

## Soak events (7d)

| Feature | Events | Unique users | Status |
|---------|--------|--------------|--------|
| onboarding completed | 0 | 0 | — |
| workout completed | 0 | 0 | — |
| voice log used | 0 | 0 | — |
| ai coach used | 0 | 0 | — |
| recovery viewed | 0 | 0 | — |
| nutrition viewed | 0 | 0 | — |
| transformation run | 0 | 0 | — |
| peak music used | 0 | 0 | — |
| watch sync used | 0 | 0 | — |
| subscription started | 0 | 0 | — |
| subscription converted | 0 | 0 | — |
| feedback submitted | 0 | 0 | — |

---

## Retention & conversion

| Metric | Value |
|--------|-------|
| DAU | 0 |
| WAU | 0 |
| 14d retention | 0% |
| Onboarding completion | 25% |
| Pro conversion | 0% |
| Trial conversion | 0% |

---

## Monitoring (24h)

| Signal | Value |
|--------|-------|
| App events | 9 |
| Feedback submissions | 0 |
| RevenueCat events | {} |
| OpenAI configured | yes |

---

## Launch blockers

- **[P1]** Internal testers 0/5 — invite via LIFTFLOW-INTERNAL
- **[P1]** Soak event missing: workout_completed (0 events in 7d)
- **[P1]** Soak event missing: voice_log_used (0 events in 7d)
- **[P1]** Soak event missing: ai_coach_used (0 events in 7d)

---

## Actions today

- [ ] Review Sentry dashboard (mobile + backend)
- [ ] Triage open feedback in Supabase `beta_feedback`
- [ ] Founder dashboard: https://liftflow-api.onrender.com/admin/founder
- [ ] Update soak tracker: [SPRINT87_INTERNAL_SOAK_TRACKER.md](./SPRINT87_INTERNAL_SOAK_TRACKER.md)

---

## Re-run

```bash
npm run beta:daily-report
```
