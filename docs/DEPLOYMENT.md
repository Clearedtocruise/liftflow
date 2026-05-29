# LiftFlow — Production Deployment Report

Generated after production deployment preparation. Complete the **Manual Steps** below to finish deployment.

---

## Automated Status

| Step | Status | Notes |
|------|--------|-------|
| 1. Push to GitHub | **BLOCKED** | Committed locally. Run `gh auth login` then push |
| 2. Render Blueprint | **READY** | `render.yaml` in repo root — deploy after GitHub push |
| 3. Render env vars | **READY** | Template below — paste from local `.env` |
| 4. Health check | **PENDING** | Returns 404 until Render deploy completes |
| 5. Localhost removed | **DONE** | `src/constants/api.ts` → production URL |
| 6. EAS production config | **DONE** | `eas.json` profiles: `production`, `production-apk` |
| 7. TestFlight build | **BLOCKED** | Requires `eas login` + Apple Developer |
| 8. Android APK build | **BLOCKED** | Requires `eas login` |
| 9. Device verification | **PENDING** | After builds complete |

---

## Manual Steps (in order)

### Step 1 — Push to GitHub

```bash
gh auth login
gh repo create liftflow --public --source=. --remote=origin --push
```

### Step 2 — Render Blueprint

1. [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**
2. Connect GitHub → select `liftflow` repo → **Apply**

### Step 3 — Render Environment Variables

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `SUPABASE_URL` | From `.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | From `.env` |
| `OPENAI_API_KEY` | Real `sk-...` key |

### Step 4 — Verify Health

```bash
curl https://liftflow-api.onrender.com/health
npm run verify:release
```

### Step 5 — EAS

```bash
eas login && eas init
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "..."
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "..."
```

### Step 6 — TestFlight

```bash
npm run build:ios
eas submit --platform ios --profile production
```

### Step 7 — Android APK

```bash
npm run build:android:apk
```

### Step 8 — Device Smoke Test

- Sign up, workout, photo upload, logout on iPhone + Android

---

## One-Command Deploy

```bash
export RENDER_API_KEY=... EXPO_TOKEN=...
node scripts/deploy-production.mjs
```
