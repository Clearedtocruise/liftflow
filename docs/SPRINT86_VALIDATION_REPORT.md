# Sprint 8.6 — TestFlight Release Candidate Validation Report

**Date:** 2026-05-31  
**Result:** FAIL  
**Checks:** 46/48  

## Scores

| Score | Value | Target |
|-------|-------|--------|
| TestFlight Readiness | **100/100** | 100 |
| Release Candidate Readiness | **80/100** | 100 |
| Production Readiness | **96/100** | 100 |
| P0 issues | **0** | 0 |
| P1 issues | **2** | 0 |

## Summary

Sprint 8.6 validates TestFlight RC readiness: Sprint 8.5 ops complete, production routes live, core/premium/advanced features, EAS build config, and testing documentation.

**Do not begin closed beta until this report shows PASS with zero P0/P1.**

## Checks

| Check | Result | Detail |
|-------|--------|--------|
| Migration 015 applied | PASS | beta_feedback exists |
| SENTRY_DSN configured | FAIL | add to .env + Render |
| EXPO_PUBLIC_SENTRY_DSN configured | FAIL | set in EAS secrets for TestFlight build |
| Sentry wiring (code) | PASS | — |
| Production health | PASS | HTTP 200 |
| Sprint 8.5 regression | PASS | 63/63 |
| Route: Feedback summary | PASS | HTTP 200 |
| Route: Events track | PASS | HTTP 200 |
| Route: Beta release notes | PASS | HTTP 200 |
| Route: Recovery intelligence | PASS | HTTP 403 |
| Route: Nutrition intelligence | PASS | HTTP 403 |
| Route: AI converse | PASS | HTTP 403 |
| Route: Smart progression | PASS | HTTP 403 |
| Route: Transformation latest | PASS | HTTP 403 |
| Beta invite codes seeded | PASS | LIFTFLOW-INTERNAL seeded |
| Authentication | PASS | — |
| Onboarding | PASS | — |
| Workout logging | PASS | — |
| Voice logging | PASS | — |
| AI Coach | PASS | — |
| Recovery Intelligence | PASS | — |
| Nutrition Intelligence | PASS | — |
| Smart Progression | PASS | — |
| RevenueCat (Sprint 8.1) | PASS | 52/52 |
| Feature gates | PASS | — |
| Restore purchases | PASS | — |
| Trial support | PASS | — |
| Transformation (8.2) | PASS | 56/56 |
| Peak Music (8.3) | PASS | 44/44 |
| Watch Companion (8.4) | PASS | 57/57 |
| HealthKit plugin | PASS | — |
| Mobile Sentry bootstrap | PASS | — |
| Feedback submission | PASS | — |
| Product analytics | PASS | — |
| Founder metrics API | PASS | — |
| Beta invite redeem UI | PASS | — |
| EAS production profile | PASS | — |
| EAS testflight profile | PASS | — |
| EAS project linked | PASS | — |
| iOS bundle identifier | PASS | — |
| Encryption compliance flag | PASS | — |
| Doc: docs/TESTFLIGHT_RC_BUILD_CHECKLIST.md | PASS | — |
| Doc: docs/TESTFLIGHT_INTERNAL_TESTING_CHECKLIST.md | PASS | — |
| Doc: docs/DEVICE_TESTING_MATRIX.md | PASS | — |
| Doc: docs/SPRINT86_KNOWN_ISSUES.md | PASS | — |
| Doc: docs/SPRINT86_BLOCKING_ISSUES.md | PASS | — |
| Doc: docs/TESTFLIGHT_SUBSCRIPTION_CHECKLIST.md | PASS | — |
| Backend TypeScript build | PASS | — |

## P0 blocking issues

_None_

## P1 blocking issues

- SENTRY_DSN: add to .env + npm run deploy:render
- EXPO_PUBLIC_SENTRY_DSN: add to EAS secrets before TestFlight

## Known issues

See [SPRINT86_KNOWN_ISSUES.md](./SPRINT86_KNOWN_ISSUES.md)

## Ops checklist

1. `npm run migrate:015`
2. `npm run seed:beta-invites`
3. Set Sentry DSNs → `npm run deploy:render`
4. `npm run build:ios:testflight`
5. Complete [TESTFLIGHT_INTERNAL_TESTING_CHECKLIST.md](./TESTFLIGHT_INTERNAL_TESTING_CHECKLIST.md)
6. Device matrix: [DEVICE_TESTING_MATRIX.md](./DEVICE_TESTING_MATRIX.md)

## Re-run

```bash
npm run validate:sprint86
```
