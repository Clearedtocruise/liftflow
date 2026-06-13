# Sprint 8.6 — TestFlight Release Candidate Validation Report

**Date:** 2026-06-13  
**Result:** PASS  
**Checks:** 56/56  

## Scores

| Score | Value | Target |
|-------|-------|--------|
| TestFlight Readiness | **100/100** | 100 |
| Release Candidate Readiness | **100/100** | 100 |
| Production Readiness | **100/100** | 100 |
| Excluding mobile Sentry blocker | **100/100** | 100 |
| P0 issues | **0** | 0 |
| P1 issues | **0** | 0 |

## TestFlight RC approval

| Decision | Status |
|----------|--------|
| Backend Sentry | **APPROVED** |
| Mobile Sentry | **APPROVED** |
| TestFlight RC build | **AUTHORIZED** |
| Closed beta | **AUTHORIZED** |

## Recommended beta launch date

**2026-06-14** (2 weeks internal TestFlight soak from RC upload)

## Remaining launch blockers

_None — ready for TestFlight RC upload_

## Summary

Sprint 8.6 validates TestFlight RC readiness: Sprint 8.5 ops complete, production routes live, Sentry backend + mobile capture verified, core/premium/advanced features, EAS build config, and testing documentation.

**Sprint 8.6 PASS — proceed with TestFlight RC upload and closed beta per [SPRINT86_CLOSURE_REPORT.md](./SPRINT86_CLOSURE_REPORT.md).**

## Checks

| Check | Result | Detail |
|-------|--------|--------|
| Migration 015 applied | PASS | beta_feedback exists |
| SENTRY_DSN configured | PASS | live on Render |
| EXPO_PUBLIC_SENTRY_DSN configured | PASS | set in .env |
| @sentry/react-native installed | PASS | — |
| Sentry Expo plugin | PASS | — |
| EAS Sentry release env | PASS | — |
| Mobile Sentry wiring | PASS | 13/13 |
| Sentry Express error handler | PASS | — |
| Sentry debug routes | PASS | — |
| Sentry wiring (code) | PASS | — |
| Production Sentry status | PASS | configured |
| Backend Sentry capture test | PASS | 10/10 |
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

_None_

## Mobile Sentry setup (if pending)

1. Sentry dashboard → **Create Project** → **React Native**
2. Copy mobile DSN (separate from Node backend DSN)
3. `eas secret:create --name EXPO_PUBLIC_SENTRY_DSN --value "<mobile-dsn>" --scope project`
4. `npx expo install @sentry/react-native` (required for native crash capture)
5. Re-run `npm run validate:sprint86`

## Known issues

See [SPRINT86_KNOWN_ISSUES.md](./SPRINT86_KNOWN_ISSUES.md)

## Ops checklist

1. `npm run migrate:015` ✓
2. `npm run seed:beta-invites` ✓
3. `npm run deploy:render` (SENTRY_DSN on Render)
4. `npm run verify:sentry` — confirm Sentry dashboard event
5. `npm run build:ios:testflight`
6. Complete [TESTFLIGHT_INTERNAL_TESTING_CHECKLIST.md](./TESTFLIGHT_INTERNAL_TESTING_CHECKLIST.md)

## Re-run

```bash
npm run deploy:render
npm run verify:sentry
npm run validate:sprint86
```
