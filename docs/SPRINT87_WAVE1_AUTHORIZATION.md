# Sprint 8.7 — Wave 1 Authorization (LIFTFLOW-BETA25)

**Status:** **PENDING** — complete internal soak first

Wave 1 opens closed beta to **25 users** using invite code `LIFTFLOW-BETA25`.

---

## Authorization gate

Wave 1 is **authorized** only when ALL conditions are met:

| Criterion | Required | Current |
|-----------|----------|---------|
| P0 issues | 0 | _check soak tracker_ |
| Recurring P1 issues | 0 | _check soak tracker_ |
| Internal testers | 5–10 | _npm run beta:daily-report_ |
| TestFlight RC processed | yes | App Store Connect |
| Core soak events (7d) | workout, voice, coach, feedback | _daily report_ |
| Crash-free sessions | >99% | Sentry dashboard |
| Internal soak exit sign-off | yes | Founder |

Run gate check:

```bash
npm run beta:daily-report
```

When `Wave 1: AUTHORIZED` appears in the daily report, proceed below.

---

## Wave 1 launch steps

1. **Confirm** zero P0/P1 in [SPRINT87_LAUNCH_BLOCKERS.md](./SPRINT87_LAUNCH_BLOCKERS.md)
2. **Prepare** invite email with TestFlight link + `LIFTFLOW-BETA25`
3. **Send** to 25 closed beta testers (not public)
4. **Monitor** daily: `npm run beta:daily-report`
5. **Support** per [BETA_SUPPORT_PLAYBOOK.md](./BETA_SUPPORT_PLAYBOOK.md)

---

## Expand to 50 users (Wave 2)

**Authorize LIFTFLOW-BETA50** after:

- 2 weeks on Wave 1
- Zero P0
- Crash-free >99%
- Feedback triage current (<24h)

---

## Rollback

Pause Wave 1 invites if:

- P0 workout logging regression
- Sentry crash rate >5%
- API 500 rate >1%

See [INCIDENT_RESPONSE_GUIDE.md](./INCIDENT_RESPONSE_GUIDE.md)
