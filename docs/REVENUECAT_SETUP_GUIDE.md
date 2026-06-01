# RevenueCat Setup Guide — LiftFlow Pro

**Sprint:** 8.1  
**Entitlement ID:** `pro` (legacy fallback: `premium`)  
**Product ID (iOS):** `com.liftflow.app.premium.monthly`  
**Offering ID:** `default`

---

## 1. Create RevenueCat project

1. Sign in at [app.revenuecat.com](https://app.revenuecat.com)
2. **New project** → name: `LiftFlow`
3. Add **iOS app**:
   - Bundle ID: `com.liftflow.app`
   - App Store Connect shared secret (from ASC → App → App Information → App-Specific Shared Secret)
4. Add **Android app** (optional for later):
   - Package: `com.liftflow.app`

---

## 2. Entitlements & products

### Entitlement

| Identifier | Display name |
|------------|--------------|
| `pro` | LiftFlow Pro |

### Product (App Store Connect first)

Create in ASC before linking in RevenueCat (see [APP_STORE_CONNECT_SUBSCRIPTION_CHECKLIST.md](./APP_STORE_CONNECT_SUBSCRIPTION_CHECKLIST.md)).

| Store | Product ID | Type |
|-------|------------|------|
| Apple | `com.liftflow.app.premium.monthly` | Auto-renewable subscription |
| Google | `liftflow_premium_monthly` | Subscription |

### Offering

1. RevenueCat → **Offerings** → `default`
2. Add package `$rc_monthly` (or custom) → attach `com.liftflow.app.premium.monthly`
3. Attach product to **`pro`** entitlement

### Introductory trial (optional)

1. App Store Connect → subscription → **Introductory Offers** → 7-day free trial
2. RevenueCat picks up trial from StoreKit — no extra code required
3. App displays trial via `SUBSCRIPTION.trialLabel` and offering `introPrice`

---

## 3. API keys

| Key | Where |
|-----|--------|
| iOS public API key | `.env` → `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` |
| iOS public API key | EAS secrets for production builds |
| Android public API key | `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` |
| Webhook secret | Render → `REVENUECAT_WEBHOOK_SECRET` |

Copy iOS key from RevenueCat → Project → API keys → **Public app-specific key (iOS)**.

---

## 4. Webhook (Supabase sync)

1. RevenueCat → **Integrations** → **Webhooks**
2. URL: `https://liftflow-api.onrender.com/api/subscriptions/webhook/revenuecat`
3. Authorization header: `Bearer <REVENUECAT_WEBHOOK_SECRET>`
4. Set same secret on Render

Events synced to `subscriptions` + `subscription_events`:
- `INITIAL_PURCHASE`, `RENEWAL`, `TRIAL_STARTED`, `TRIAL_CONVERTED`, `CANCELLATION`, `EXPIRATION`, etc.

---

## 5. Sandbox testing

1. App Store Connect → **Users and Access** → **Sandbox** → create tester
2. Install **TestFlight** or dev client build (not Expo Go)
3. Sign in with sandbox Apple ID when prompted at purchase
4. Use **Restore Purchases** in app to verify entitlement restore

### Dev bypass (no StoreKit)

Backend sandbox upgrade (authenticated user):

```bash
curl -X POST https://liftflow-api.onrender.com/api/subscriptions/upgrade \
  -H "Authorization: Bearer <supabase-access-token>" \
  -H "Content-Type: application/json" \
  -d '{"tier":"premium","sandbox":true}'
```

---

## 6. Code reference

| Component | Path |
|-----------|------|
| Constants | `src/constants/subscription.ts` |
| Service | `src/services/subscriptionService.ts` |
| Hook | `src/hooks/useSubscription.ts`, `useEntitlement.ts` |
| Gating | `src/components/subscription/PremiumGate.tsx` (`FeatureGate`) |
| API middleware | `backend/src/middleware/requireProSubscription.ts` |

---

## 7. Render environment

```env
REVENUECAT_WEBHOOK_SECRET=<from RevenueCat webhook>
# Optional: disable API Pro gate for Sprint 7.9 gate user only
# SUBSCRIPTION_GATE_DISABLED=1
```

Remove `SUBSCRIPTION_GATE_DISABLED` before public beta so free users receive HTTP 403 on Pro API routes.

---

## 8. Validation

```bash
npm run validate:sprint81
```

Target: **PASS** before starting Sprint 8.2 (Transformation Engine).
