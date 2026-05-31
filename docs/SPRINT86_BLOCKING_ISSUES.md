# Sprint 8.6 — Blocking Issues

**Zero P0 and zero P1 required** before closed beta or App Store prep.

Update status after each `npm run validate:sprint86` run.

| ID | Issue | Severity | Status | Resolution |
|----|-------|----------|--------|------------|
| B-01 | Migration 015 not applied | P0 | **Closed** | Applied 2026-05-31 |
| B-02 | Backend Sprint 8.5 routes 404 on production | P0 | **Closed** | Deployed to Render |
| B-03 | Beta invite codes not seeded | P1 | **Closed** | LIFTFLOW-INTERNAL, BETA25, BETA50 |
| B-04 | SENTRY_DSN not set (Render) | P1 | Open | See [SENTRY_SETUP.md](./SENTRY_SETUP.md) |
| B-05 | EXPO_PUBLIC_SENTRY_DSN not in EAS secrets | P1 | Open | `eas secret:create` |
| B-06 | EXPO_PUBLIC_REVENUECAT_IOS_API_KEY missing | P1 | Open | RevenueCat dashboard → EAS secret |
| B-07 | validate:sprint86 FAIL | P0 | Open | Fix remaining blockers |
| B-08 | OPENAI_API_KEY missing on Render | P0 | **Closed** | Configured |
| B-09 | Production intelligence routes 404 | P0 | **Closed** | Routes live (403 gated) |

## Auto-detection

Run:

```bash
npm run validate:sprint86
```

The validator updates this file’s recommended actions in [SPRINT86_VALIDATION_REPORT.md](./SPRINT86_VALIDATION_REPORT.md).

## Clearance

When all rows are **Closed** and validator PASS:

- [ ] Upload TestFlight RC
- [ ] Complete [TESTFLIGHT_INTERNAL_TESTING_CHECKLIST.md](./TESTFLIGHT_INTERNAL_TESTING_CHECKLIST.md)
- [ ] Proceed to closed beta (Sprint 8.7+)

**Do not** invite external beta testers while any P0 remains open.
