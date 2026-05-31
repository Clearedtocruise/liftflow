# Sprint 8.6 — Known Issues (TestFlight RC)

Non-blocking issues acceptable for internal TestFlight. Track fixes before closed beta.

| ID | Area | Issue | Severity | Workaround |
|----|------|-------|----------|------------|
| K-01 | Infra | Render free tier cold start (30–60s) | P2 | Retry; upgrade plan pre-beta |
| K-02 | Expo Go | IAP/HealthKit/Watch/Music unavailable | P2 | TestFlight only |
| K-03 | Peak Music | Requires Apple Music + dev client entitlements | P2 | Document in beta invite |
| K-04 | Watch | Full E2E needs paired Apple Watch | P2 | Phone-only beta path |
| K-05 | iPad | Portrait phone layout on tablet | P2 | iPhone recommended |
| K-06 | Voice | Noisy gym → lower recognition accuracy | P2 | Manual confirm sheet |
| K-07 | AI | Occasional verbose coach responses | P2 | Report via feedback |
| K-08 | Sentry | No events until DSN configured in EAS | P1 | Set EXPO_PUBLIC_SENTRY_DSN |
| K-09 | RevenueCat | Requires sandbox Apple ID for IAP test | P2 | See TESTFLIGHT_SUBSCRIPTION_CHECKLIST |
| K-10 | Transformation | Photo lighting affects projection quality | P2 | Retake in even lighting |

**Severity:** P0 = ship blocker · P1 = fix before closed beta · P2 = acceptable with workaround

Update this list after each TestFlight build.
