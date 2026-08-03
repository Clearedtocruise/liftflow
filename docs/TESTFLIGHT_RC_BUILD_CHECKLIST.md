# TestFlight Release Candidate — Build Checklist (Sprint 8.6)

Use this checklist before uploading a build to TestFlight.

## Pre-build gates

```bash
npm run validate:sprint86    # Target: PASS, 100/100 scores
npm run validate:sprint85    # Beta readiness regression
```

| Gate | Target |
|------|--------|
| Sprint 8.5 ops complete | Migration 015, deploy, invites seeded |
| Zero P0 issues | See [SPRINT86_BLOCKING_ISSUES.md](./SPRINT86_BLOCKING_ISSUES.md) |
| Zero P1 issues | Same |

---

## 1. Environment & secrets (EAS)

Set via `eas secret:create` or Expo dashboard — **never commit to git**:

| Secret | Required |
|--------|----------|
| `EXPO_PUBLIC_SENTRY_DSN` | Yes — crash reporting |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | Yes — IAP on TestFlight |
| `EXPO_PUBLIC_SENTRY_ENVIRONMENT` | `production` or `testflight` |
| `EXPO_PUBLIC_SENTRY_RELEASE` | e.g. `liftflow@1.0.0` (match app version) |

### Cursor Cloud Agents secrets

Configure at [cursor.com/dashboard/cloud-agents](https://cursor.com/dashboard/cloud-agents):

| Secret | Required | Notes |
|--------|----------|-------|
| `EXPO_TOKEN1` | Yes for cloud TF builds | liftflow1 account — same token as Build 323 |
| `EXPO_TOKEN` | **Delete** | Wrong account (immadoer) — cannot build `@liftflow1/liftflow` |

After changing secrets, **restart** the cloud agent so they inject.

Verify local `.env` mirrors production API URL:

```
EXPO_PUBLIC_API_URL=https://liftflow-api.onrender.com
```

---

## 2. Backend (Render)

- [ ] Latest `main` deployed: `npm run deploy:render`
- [ ] Health: `GET /health` → `{ status: "ok", openai: "configured", supabase: "configured" }`
- [ ] Sprint 8.5 routes live (non-404):
  - `GET /api/feedback/summary`
  - `POST /api/events/track`
  - `GET /api/beta/release-notes`
  - `GET /api/beta/metrics` (founder key)
- [ ] `SENTRY_DSN` set on Render

---

## 3. Supabase

- [ ] Migration 015 applied: `npm run migrate:015`
- [ ] Beta invites seeded: `npm run seed:beta-invites`
- [ ] Auth redirects configured for production API

---

## 4. EAS build

```bash
# TestFlight (App Store distribution)
npm run build:ios:testflight

# Or production profile (same result)
npm run build:ios
```

| Profile | Use |
|---------|-----|
| `testflight` | RC builds for TestFlight |
| `production` | App Store release |
| `development` | Dev client only — **not** for beta testers |

After build completes:

```bash
eas submit --platform ios --profile production
```

---

## 5. App Store Connect

- [ ] Build processed (no missing compliance)
- [ ] Export compliance: **No** non-exempt encryption (`ITSAppUsesNonExemptEncryption: false`)
- [ ] Privacy nutrition labels updated
- [ ] Subscription products linked to RevenueCat
- [ ] TestFlight “What to Test” notes filled from [RELEASE_NOTES_TEMPLATE.md](./RELEASE_NOTES_TEMPLATE.md)

---

## 6. Post-upload smoke (TestFlight build)

On a physical iPhone (not Expo Go):

- [ ] Login / signup
- [ ] Complete or skip onboarding
- [ ] Start → log sets → finish workout
- [ ] Voice log one set
- [ ] Open AI Coach → ask one question
- [ ] Submit test feedback (Settings → Send Feedback)
- [ ] Trigger test crash (internal only) → verify Sentry event
- [ ] Start trial / sandbox purchase → restore purchases

---

## 7. Do not proceed if

- `validate:sprint86` FAIL
- Any P0 in [SPRINT86_BLOCKING_ISSUES.md](./SPRINT86_BLOCKING_ISSUES.md)
- Production API returns 404 on intelligence or beta routes
- Build is Expo Go (IAP, HealthKit, Watch, MusicKit unavailable)

---

## Quick commands

```bash
npm run migrate:015
npm run seed:beta-invites
npm run deploy:render
npm run validate:sprint86
npm run build:ios:testflight
```
