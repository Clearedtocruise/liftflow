# TestFlight — Subscription Testing Checklist

Use this checklist before inviting beta testers who will purchase or trial LiftFlow Pro.

---

## Build requirements

- [ ] **Not Expo Go** — use EAS dev client or TestFlight production profile
- [ ] `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` set in EAS secrets
- [ ] `EXPO_PUBLIC_API_URL` points to production Render API
- [ ] Backend deployed with Pro middleware (`requireProSubscription`)

```bash
npm run build:ios
# or
npm run build:ios:dev
```

---

## RevenueCat & ASC

- [ ] RevenueCat project linked to ASC shared secret
- [ ] Entitlement **`pro`** created
- [ ] Product `com.liftflow.app.premium.monthly` in `default` offering
- [ ] Webhook configured → `POST /api/subscriptions/webhook/revenuecat`
- [ ] Render `REVENUECAT_WEBHOOK_SECRET` set

---

## Sandbox account

- [ ] Sandbox Apple ID created (unique email, not your personal Apple ID)
- [ ] Signed out of personal App Store account on test device (Settings → App Store)
- [ ] First purchase prompts sandbox login

---

## Test matrix

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Fresh install, free user | Workout logging works; AI Coach shows upgrade |
| 2 | Tap Upgrade → Start trial | StoreKit sheet; Pro unlocks after confirm |
| 3 | Recovery Intelligence | Dashboard loads (HTTP 200) |
| 4 | Nutrition Intelligence | Macros/meals visible |
| 5 | Smart Progression | Card visible during active workout |
| 6 | Coach Chat | Conversational panel works |
| 7 | Restore Purchases | Pro restored after reinstall |
| 8 | Manage Subscription | Opens Apple subscription settings |
| 9 | Cancel subscription | Pro access until period end |
| 10 | Webhook | `subscription_events` row in Supabase |

---

## Free vs Pro surfaces

**Free:** workout tab, history, progress photos, basic dashboard recovery score  
**Pro:** coaching tab AI, intelligence screens, smart progression, health sync, peak music, watch assistant

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Product not found" | ASC product not linked in RevenueCat offering |
| Purchase succeeds, no Pro | Check entitlement id is `pro`; verify webhook |
| 403 on intelligence API | User not Pro in Supabase; run Restore Purchases |
| Expo Go | Expected — IAP unavailable; use TestFlight |

---

## Automated validation

```bash
npm run validate:sprint81
```

Report: [SPRINT81_VALIDATION_REPORT.md](./SPRINT81_VALIDATION_REPORT.md)

---

## Sign-off

- [ ] Sandbox purchase PASS
- [ ] Restore PASS
- [ ] Trial flow PASS (if enabled)
- [ ] Free user blocked on Pro API (HTTP 403)
- [ ] `validate:sprint81` PASS

**Only after sign-off:** begin Sprint 8.2 (Transformation Engine).
