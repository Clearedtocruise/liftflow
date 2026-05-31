# Incident Response Guide — LiftFlow Beta

## Severity levels

| Level | Definition | Example |
|-------|------------|---------|
| SEV-1 | Service down or data breach | API 500 for all users, Supabase RLS bypass |
| SEV-2 | Core feature broken for majority | Cannot log workouts, all AI 500 |
| SEV-3 | Degraded or subset impact | Watch sync fails, peak music only |
| SEV-4 | Minor / cosmetic | Typo, non-blocking UI |

## Response steps

1. **Detect** — Sentry alert, founder dashboard monitoring spike, tester report
2. **Acknowledge** — Post in internal channel within 15 min (SEV-1/2)
3. **Mitigate** — Roll back Render deploy, disable feature flag, `SUBSCRIPTION_GATE_DISABLED` only if billing broken
4. **Communicate** — Update `BETA_KNOWN_ISSUES.md`; email affected testers if SEV-1/2
5. **Resolve** — Fix forward, verify with `validate:sprint85` subset
6. **Post-mortem** — Within 48h for SEV-1/2: timeline, root cause, prevention

## Monitoring sources

- Sentry (mobile + backend + AI tag)
- Render status / logs
- `GET /api/beta/monitoring` (founder key)
- OpenAI usage dashboard

## Contacts

- Founder on-call: primary app owner
- Supabase: dashboard → support for DB incidents
- RevenueCat: dashboard for IAP outages

## Rollback

```bash
# Redeploy previous Render commit from dashboard
# Or push revert via scripts/push-main-via-api.mjs
```

Never force-push main without explicit approval.
