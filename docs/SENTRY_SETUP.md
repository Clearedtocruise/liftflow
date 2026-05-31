# Sentry Setup — LiftFlow (Sprint 8.5/8.6)

Required before TestFlight RC validation passes with zero P1 issues.

## 1. Create projects

1. Sign up at [sentry.io](https://sentry.io)
2. Create **React Native** project → copy DSN → `EXPO_PUBLIC_SENTRY_DSN`
3. Create **Node.js** project → copy DSN → `SENTRY_DSN`

## 2. Local / Render (backend)

Add to `.env`:

```
SENTRY_DSN=https://…@….ingest.sentry.io/…
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=liftflow-api@1.0.0
SENTRY_TRACES_SAMPLE_RATE=0.1
```

Redeploy:

```bash
npm run deploy:render
```

## 3. EAS (mobile TestFlight)

```bash
eas secret:create --name EXPO_PUBLIC_SENTRY_DSN --value "https://…" --scope project
eas secret:create --name EXPO_PUBLIC_SENTRY_ENVIRONMENT --value "production" --scope project
eas secret:create --name EXPO_PUBLIC_SENTRY_RELEASE --value "liftflow@1.0.0" --scope project
```

Or set in [Expo dashboard](https://expo.dev) → Project → Secrets.

## 4. Verify

```bash
npm run validate:sprint86
```

Trigger a test error on device (internal build only) and confirm event in Sentry dashboard within 5 minutes.

## Notes

- Mobile Sentry is a no-op until `@sentry/react-native` is installed and DSN is set
- Backend captures AI route errors via `captureAiError`
- Do not commit DSN values to git
