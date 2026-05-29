# LiftFlow — Final Release Checklist

## 1. Supabase Auth (Testing)

- [ ] Add `SUPABASE_ACCESS_TOKEN` to `.env` ([create token](https://supabase.com/dashboard/account/tokens))
- [ ] Run `npm run configure:auth` (sets autoconfirm + raises email rate limits)
- [ ] **Manual fallback:** Dashboard → Authentication → Providers → Email → **disable Confirm email**
- [ ] Dashboard → Authentication → Rate Limits → raise email/signup limits

## 2. Backend (Render)

- [ ] Push repo to GitHub
- [ ] [Render Dashboard](https://dashboard.render.com) → **New Blueprint** → select `render.yaml`
- [ ] Set env vars on Render:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `OPENAI_API_KEY`
- [ ] Confirm health: `https://liftflow-api.onrender.com/health`
  - Expect: `{ "status": "ok", "openai": "configured", "supabase": "configured" }`

## 3. Mobile Environment

- [ ] Set in `.env` (and EAS secrets for CI builds):
  ```
  EXPO_PUBLIC_API_URL=https://liftflow-api.onrender.com
  EXPO_PUBLIC_SUPABASE_URL=https://jaajsalblkjtmrapijbe.supabase.co
  EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
  ```
- [ ] Run `npm run verify:release` — all checks PASS

## 4. OpenAI

- [ ] Add real `OPENAI_API_KEY` to Render service env (not committed to git)
- [ ] Verify `/api/body/estimate-body-fat` returns real analysis (not demo fallback)
- [ ] Verify `/api/ai/coach` returns coaching responses

## 5. EAS / Expo Account

- [ ] `npm install -g eas-cli`
- [ ] `eas login`
- [ ] `eas init` (links project, sets `EAS_PROJECT_ID` in app.config.ts extra)
- [ ] Apple Developer account enrolled ($99/yr)
- [ ] Google Play Console account (for Play Store; APK works without)

## 6. TestFlight (iOS)

```bash
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

- [ ] Update `eas.json` → `submit.production.ios.appleTeamId`
- [ ] Add testers in App Store Connect → TestFlight
- [ ] Install on physical iPhone via TestFlight

## 7. APK (Android)

```bash
eas build --platform android --profile preview
```

- [ ] Download APK from EAS build page
- [ ] Install on physical Android device (enable unknown sources)
- [ ] Or use internal distribution link from EAS

## 8. Physical Device Verification

### iPhone
- [ ] Sign up / log in
- [ ] Profile + nutrition_goals created (Settings shows user email)
- [ ] Start workout → voice log a set ("Bench press 135 for 8")
- [ ] Finish workout → no auto-restart of session
- [ ] History shows completed workout
- [ ] Progress tab → upload photo → appears in gallery
- [ ] Log out → returns to login screen

### Android
- [ ] Same checklist as iPhone
- [ ] Microphone permission granted for voice logging
- [ ] Photo library permission for progress photos

## 9. Pre-Production Blockers

| Item | Status | Action |
|------|--------|--------|
| Email rate limits | Manual | Run `configure:auth` script |
| Render backend live | Deploy | Connect GitHub → Blueprint |
| OpenAI key on Render | Env var | Set in Render dashboard |
| EAS project linked | One-time | `eas init` |
| Apple Team ID | Config | Update `eas.json` submit section |
| Package version drift | Optional | Align Expo SDK 54 package versions |

## 10. Quick Commands

```bash
npm run configure:auth      # Supabase auth for testing
npm run verify:release      # Pre-flight checks
npm run build:ios           # TestFlight build
npm run build:android:apk   # APK build
cd backend && npm run dev   # Local API (dev only)
```
