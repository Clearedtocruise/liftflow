# App Store Connect — Subscription Checklist

**Product:** ONE MORE Pro  
**Bundle ID:** `com.liftflow.app`  
**Subscription product ID:** `com.liftflow.app.premium.monthly`

---

## Pre-requisites

- [ ] Apple Developer Program enrollment active
- [ ] App record created in App Store Connect for `com.liftflow.app`
- [ ] Paid Applications Agreement accepted (Banking & Tax)

---

## Create subscription group

1. App Store Connect → your app → **Subscriptions**
2. **Create Subscription Group** → name: `ONE MORE Pro`
3. Reference name: `ONE MORE Pro Monthly`

---

## Create subscription product

| Field | Value |
|-------|--------|
| Product ID | `com.liftflow.app.premium.monthly` |
| Duration | 1 month |
| Price | Tier matching **$9.99 USD** (or your chosen price) |
| Display name | ONE MORE Pro |
| Description | AI coaching, recovery & nutrition intelligence, smart progression, integrations |

---

## Introductory offer (trial)

- [ ] Add **Introductory Offer** → Free trial → **7 days**
- [ ] Match app copy: `7-day free trial` in `src/constants/subscription.ts`

---

## Localization

- [ ] Subscription display name (English)
- [ ] Description listing Pro features (AI Coach, Recovery Intelligence, etc.)
- [ ] Review notes: demo account if required

---

## Link to RevenueCat

1. Copy **App-Specific Shared Secret** (ASC → App → App Information)
2. Paste in RevenueCat iOS app settings
3. In RevenueCat, import product `com.liftflow.app.premium.monthly`
4. Attach to entitlement **`pro`**

---

## Legal URLs (required for review)

| Field | URL |
|-------|-----|
| Privacy Policy | `https://liftflow-api.onrender.com/legal/privacy` |
| Terms of Use | `https://liftflow-api.onrender.com/legal/terms` |
| Support | `https://liftflow-api.onrender.com/legal/support` |

In-app: Settings → Subscription Terms, Restore Purchases, Manage Subscription.

---

## Sandbox verification

- [ ] Create Sandbox tester (ASC → Users and Access → Sandbox)
- [ ] Purchase in TestFlight build
- [ ] Confirm Pro features unlock
- [ ] Cancel in Apple ID → Subscriptions → confirm access until period end
- [ ] Restore Purchases on second device / reinstall

---

## RevenueCat ↔ ASC mapping

| App Store Connect | RevenueCat |
|-------------------|------------|
| `com.liftflow.app.premium.monthly` | Product in `default` offering |
| Subscription group | Entitlement `pro` |
| 7-day intro offer | Auto-detected by SDK |

---

## Validation

```bash
npm run validate:sprint81
```

See also [REVENUECAT_SETUP_GUIDE.md](./REVENUECAT_SETUP_GUIDE.md) and [TESTFLIGHT_SUBSCRIPTION_CHECKLIST.md](./TESTFLIGHT_SUBSCRIPTION_CHECKLIST.md).
