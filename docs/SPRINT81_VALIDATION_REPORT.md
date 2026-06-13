# Sprint 8.1 — RevenueCat Validation Report

**Date:** 2026-06-13  
**Result:** PASS  
**Score:** 52/52  

## Summary

Sprint 8.1 delivers RevenueCat integration, Pro entitlement gating (client + API), subscription UI, trial support, and App Store readiness documentation.

## Checks

| Check | Result | Detail |
|-------|--------|--------|
| File: src/constants/subscription.ts | PASS | — |
| File: src/lib/entitlements.ts | PASS | — |
| File: src/services/subscriptionService.ts | PASS | — |
| File: src/contexts/SubscriptionContext.tsx | PASS | — |
| File: src/hooks/useSubscription.ts | PASS | — |
| File: src/hooks/useEntitlement.ts | PASS | — |
| File: src/components/subscription/PremiumGate.tsx | PASS | — |
| File: src/components/subscription/UpgradePrompt.tsx | PASS | — |
| File: src/components/subscription/RestorePurchasesButton.tsx | PASS | — |
| File: src/components/subscription/ProPlanComparison.tsx | PASS | — |
| File: src/app/(features)/subscription.tsx | PASS | — |
| File: src/app/(features)/upgrade.tsx | PASS | — |
| File: src/app/(features)/manage-subscription.tsx | PASS | — |
| File: backend/src/middleware/requireProSubscription.ts | PASS | — |
| File: docs/REVENUECAT_SETUP_GUIDE.md | PASS | — |
| File: docs/APP_STORE_CONNECT_SUBSCRIPTION_CHECKLIST.md | PASS | — |
| File: docs/TESTFLIGHT_SUBSCRIPTION_CHECKLIST.md | PASS | — |
| Entitlement id = pro | PASS | — |
| Legacy entitlement fallback | PASS | — |
| PRO_FEATURE_IDS defined | PASS | — |
| Trial config | PASS | — |
| subscriptionService.purchasePremium | PASS | — |
| subscriptionService.restorePurchases | PASS | — |
| subscriptionService.syncFromRevenueCat | PASS | — |
| subscriptionService.getEntitlementStatus | PASS | — |
| subscriptionService.grantSandboxPro | PASS | — |
| subscriptionService.trial_started | PASS | — |
| hasProFeature() | PASS | — |
| isTrialingSubscription() | PASS | — |
| Gate: coaching.tsx | PASS | — |
| Gate: coach-chat | PASS | — |
| Gate: recovery-analysis | PASS | — |
| Gate: nutrition-intelligence | PASS | — |
| Gate: suggested-workouts | PASS | — |
| Gate: workout smart progression | PASS | — |
| Gate: peak music | PASS | — |
| Gate: healthkit | PASS | — |
| Gate: apple watch | PASS | — |
| requirePro on recovery/intelligence | PASS | — |
| requirePro on progression/smart | PASS | — |
| requirePro on recommendations/daily | PASS | — |
| requirePro on nutrition/intelligence | PASS | — |
| requirePro on ai/converse | PASS | — |
| requirePro on ai/coach | PASS | — |
| requirePro on ai/tts | PASS | — |
| Webhook trial events | PASS | — |
| Webhook subscription_events insert | PASS | — |
| Backend TypeScript build | PASS | — |
| Free user blocked on recovery/intelligence | PASS | HTTP 403 |
| RevenueCat setup guide | PASS | — |
| ASC checklist | PASS | — |
| TestFlight checklist | PASS | — |

## Next steps (ops)

1. Create RevenueCat project + `pro` entitlement — see [REVENUECAT_SETUP_GUIDE.md](./REVENUECAT_SETUP_GUIDE.md)
2. Create ASC product `com.liftflow.app.premium.monthly` — see [APP_STORE_CONNECT_SUBSCRIPTION_CHECKLIST.md](./APP_STORE_CONNECT_SUBSCRIPTION_CHECKLIST.md)
3. EAS secret `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
4. Render: `REVENUECAT_WEBHOOK_SECRET`
5. Sandbox purchase on TestFlight — see [TESTFLIGHT_SUBSCRIPTION_CHECKLIST.md](./TESTFLIGHT_SUBSCRIPTION_CHECKLIST.md)

## Re-run

```bash
npm run validate:sprint81
```
