# Beta Support Playbook

## Channels

1. **In-app feedback** — Settings → Report a bug / Request a feature → `beta_feedback` table
2. **Email** — support@liftflow.app (legal support page)
3. **Founder dashboard** — triage open feedback items daily

## Triage workflow

| Priority | Criteria | Response SLA |
|----------|----------|--------------|
| P0 | Crash, data loss, cannot log in | 4 hours |
| P1 | Workout blocked, Pro purchase failed | 24 hours |
| P2 | UI bug, voice misfire | 48 hours |
| P3 | Feature request | Weekly roundup |

## Steps

1. Acknowledge receipt (auto message from feedback API)
2. Reproduce with tester `userId` + Sentry session
3. Update `beta_feedback.status` → triaged / resolved
4. Add to `docs/BETA_KNOWN_ISSUES.md` if widespread
5. Ship fix in next TestFlight build; note in release notes

## Escalation

- Payment issues → RevenueCat dashboard + ASC
- AI failures → check OpenAI usage + Sentry `subsystem:ai` tag
- HealthKit → verify dev client build, not Expo Go

## Tester communication template

> Thanks for the beta feedback. We've logged [ID] and prioritized as [P1/P2]. Expect an update in [timeframe]. Build [version] includes a fix when shipped.
