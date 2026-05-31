# Beta Risk Register — Top Launch Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|------------|--------|------------|
| 1 | Expo Go testers hit Pro/IAP walls | High | Medium | TestFlight-only invites; checklist |
| 2 | Sentry DSN not configured | Medium | High | validate:sprint85 + Render/EAS secrets |
| 3 | Migration 015 not applied | Medium | High | migrate:apply before beta |
| 4 | OpenAI rate limits / billing | Medium | High | Usage monitoring; fallbacks |
| 5 | RevenueCat webhook misconfig | Medium | High | Sprint 8.1 checklist |
| 6 | Supabase RLS misconfiguration | Low | Critical | Migration review |
| 7 | Crash spike undetected | Medium | High | Sentry alerts + founder dashboard |
| 8 | Feedback inbox overload | Medium | Medium | Support playbook SLA |
| 9 | HealthKit permission denial | High | Low | Clear onboarding copy |
| 10 | Watch sync false expectations | Medium | Medium | BETA_KNOWN_ISSUES |
| 11 | Peak music provider confusion | Medium | Low | Provider limitations doc |
| 12 | Transformation math misunderstood | Low | Medium | Disclaimer in UI |
| 13 | Beta invite code leak | Low | Medium | max_uses + expiry |
| 14 | Render cold start latency | Medium | Medium | Health checks; upgrade plan |
| 15 | TestFlight review delay | Medium | Medium | Buffer 1 week |
| 16 | P0 bug in workout logging | Low | Critical | Soak with 5 internal first |
| 17 | Data sync offline gaps | Medium | Medium | Offline queue (Watch); retry |
| 18 | AI coach inappropriate output | Low | High | Moderation + disclaimers |
| 19 | Subscription gate blocks gate tests | Low | Low | SUBSCRIPTION_GATE_DISABLED on Render only for CI |
| 20 | Founder dashboard key exposure | Low | Critical | FOUNDER_ADMIN_KEY rotation |

**Review cadence:** Weekly during beta soak.
