# LiftFlow — Release Candidate Checklist (Sprint 7.9)

## Pre-flight validation

Run the full RC gate:

```bash
npm run validate:sprint79
```

Target: **100/100** with zero FAIL areas.

| Check | Command |
|-------|---------|
| Sprint regression (7.0–7.6, 7.X) | Included in `validate:sprint79` |
| Smart progression (7.1) | `npm run validate:sprint71` |
| Local API E2E | `npm run test:local-api` |
| Cross-feature integration | `npm run test:integration` |
| HealthKit dev build (static) | `npm run verify:healthkit` |
| Gym types (migration 010) | `npm run verify:gym-types` |

---

## 1. Supabase

- [ ] Add `SUPABASE_ACCESS_TOKEN` to `.env` ([create token](https://supabase.com/dashboard/account/tokens))
- [ ] Apply migration 010: `npm run migrate:010` (or SQL Editor → `010_coach_onboarding.sql`)
- [ ] Verify: `npm run verify:gym-types` → **5/5 PASS**
- [ ] Apply migration 012 (health sync) if not applied
- [ ] Run `npm run configure:auth` for beta testing (autoconfirm email)

---

## 2. Backend (Render)

- [ ] Commit and push backend Sprint 7.2–7.6 + 7.1 routes to `main`
- [ ] Set Render env vars:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `OPENAI_API_KEY` (required for full AI coach + TTS)
- [ ] Deploy: `npm run deploy:render`
- [ ] Confirm health: `https://liftflow-api.onrender.com/health`
  - Expect: `{ "openai": "configured", "supabase": "configured" }`
- [ ] Confirm intelligence routes (non-404):
  - `GET /api/training/recovery/intelligence?userId=…`
  - `GET /api/nutrition/intelligence?userId=…`
  - `POST /api/ai/converse`
  - `POST /api/training/progression/smart`

---

## 3. Mobile environment

- [ ] `.env` / EAS secrets:
  ```
  EXPO_PUBLIC_API_URL=https://liftflow-api.onrender.com
  EXPO_PUBLIC_SUPABASE_URL=https://jaajsalblkjtmrapijbe.supabase.co
  EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
  ```
- [ ] `npm run verify:release` — all checks PASS

---

## 4. OpenAI end-to-end

- [ ] `OPENAI_API_KEY` on Render (not in git)
- [ ] `POST /api/ai/converse` returns GPT response (not heuristic-only)
- [ ] `POST /api/ai/tts` returns audio or 503 with fallback message
- [ ] Conversational coach in app references recovery + nutrition context

---

## 5. HealthKit (physical iPhone — not Expo Go)

- [ ] `npm run build:ios:dev` (dev client with HealthKit entitlements)
- [ ] Install on physical iPhone
- [ ] Settings → Health Sync → grant permissions
- [ ] Dashboard recovery card shows synced HRV/sleep (if Apple Health has data)

---

## 6. Integration smoke (device or simulator + production API)

- [ ] Start workout → smart progression card shows recommendation
- [ ] Recovery intelligence loads on coaching tab
- [ ] Nutrition intelligence loads on nutrition tab
- [ ] Ask coach: “What should I train today?” — uses recovery + recommendations
- [ ] Voice log a set → rest timer → finish workout

---

## 7. TestFlight / App Store

```bash
npm run build:ios          # TestFlight
npm run build:android:apk  # Android APK
```

- [ ] App Store Connect listing (screenshots, privacy, age rating)
- [ ] RevenueCat IAP linked (`EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`)
- [ ] TestFlight internal testers invited

---

## 8. Quick commands

```bash
npm run validate:sprint79       # RC gate (target 100/100)
npm run migrate:010             # Gym type constraints
npm run test:local-api          # Local backend route E2E
npm run deploy:render           # Production deploy + route verify
npm run configure:auth          # Supabase auth for beta
cd backend && npm run dev       # Local API only
```

---

## Blocker resolution (Sprint 7.8 → 7.9)

| Blocker | Resolution |
|---------|------------|
| Production 404 on intelligence routes | Push `main` + `deploy:render` |
| OPENAI missing on Render | Set env var + redeploy |
| Smart progression partial | Shipped: API + service + workout UI |
| Migration 010 gym types | `npm run migrate:010` |

Report: [BETA_READINESS_SPRINT79.md](./BETA_READINESS_SPRINT79.md)
