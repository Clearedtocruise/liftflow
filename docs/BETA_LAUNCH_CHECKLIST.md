# Beta Launch Checklist — LiftFlow

Use before inviting the first 25 closed beta testers.

## Infrastructure

- [ ] Apply migration `015_sprint85_beta_readiness.sql` to Supabase
- [ ] Set `SENTRY_DSN` on Render + `EXPO_PUBLIC_SENTRY_DSN` in EAS secrets
- [ ] Deploy backend with `/api/feedback`, `/api/events`, `/api/beta` routes
- [ ] Verify founder dashboard: `/admin/founder` + `GET /api/founder/dashboard`
- [ ] Run `npm run validate:sprint85` → PASS

## TestFlight

- [ ] EAS build with dev client or TestFlight profile
- [ ] RevenueCat sandbox configured (Sprint 8.1)
- [ ] Create 3–5 beta invite codes in Supabase `beta_invites`
- [ ] Internal testers flagged via `is_internal = true` invites

## Ops

- [ ] Update `docs/BETA_KNOWN_ISSUES.md` with current limitations
- [ ] Support inbox monitored (`support@liftflow.app`)
- [ ] Founder reviews feedback daily via dashboard `betaOps.feedbackSummary`
- [ ] Incident response guide reviewed by on-call founder

## Soak criteria (before expanding beyond 25 users)

- [ ] Zero P0 crashes in Sentry for 7 days
- [ ] ≥10 workout sessions per active tester
- [ ] Feedback triage within 48 hours
- [ ] API p95 latency acceptable on Render

## Recommended scale

| Phase | Testers | Duration |
|-------|---------|----------|
| Internal | 5–10 | 1 week |
| Closed beta | 25 | 2 weeks |
| Expanded beta | 50 | 2–4 weeks |

Do **not** open public beta or TestFlight RC until Sprint 8.5 validator PASS.
