# BRANDING_AUDIT — Sprint 8.8.1

Generated: 2026-06-01T05:42:40.491Z

## Executive Summary

| Item | Status |
|------|--------|
| Public brand | **ONE MORE** |
| Tagline | **Only One.** |
| iOS build number | **11** |
| App icon source | `assets/branding/one-more-icon-1024.png` |
| Splash source | `assets/branding/one-more-splash-full-512.png` |
| User-facing legacy leaks | **50 found** |

## Root Cause (TestFlight legacy icon)

The previous TestFlight build referenced `liftflow-icon-*` paths and `assets/images/icon.png` still contained a **964KB legacy PNG** (old LiftFlow artwork). Sprint 8.8.1:

1. Regenerated the full ONE MORE asset pack from `one-more-logo-primary.svg`
2. Installed icons into **both** `assets/branding/` and `assets/images/`
3. Pointed `app.config.ts` exclusively at `one-more-*` paths
4. Replaced legacy LF vector sources (`liftflow-logo-*.svg`)
5. Incremented iOS buildNumber → **11**

## Files Changed (config)

- `app.config.ts` — icon, adaptiveIcon, splash, favicon, notifications icon → `one-more-*`
- `scripts/generate-one-more-icons.mjs` — full asset pack installer
- `scripts/validate-branding-enforcement.mjs` — pre-build gate

## Logo Assets Replaced

- ✓ `assets/branding/one-more-logo-primary.svg`
- ✓ `assets/branding/one-more-splash-full.svg`
- ✓ `assets/branding/one-more-og.svg`
- ✓ `assets/branding/one-more-icon-1024.png`
- ✓ `assets/branding/one-more-icon-512.png`
- ✓ `assets/branding/one-more-icon-256.png`
- ✓ `assets/branding/one-more-splash-full-512.png`
- ✓ `assets/branding/one-more-splash-512.png`
- ✓ `assets/images/icon.png`
- ✓ `assets/images/favicon.png`
- ✓ `assets/images/splash-icon.png`
- ✓ `assets/images/android-icon-foreground.png`
- ✓ `assets/images/android-icon-monochrome.png`
- ✓ `public/favicon-one-more.png`
- ✓ `public/favicon.png`
- ✓ `public/og-one-more.png`
- ✓ `public/one-more-mark.svg`

### Generated this run

- `assets/branding/one-more-icon-1024.png`
- `assets/branding/one-more-icon-512.png`
- `assets/branding/one-more-icon-256.png`
- `assets/branding/one-more-icon-192.png`
- `assets/branding/one-more-icon-128.png`
- `assets/branding/one-more-splash-512.png`
- `assets/images/icon.png`
- `assets/images/favicon.png`
- `assets/images/splash-icon.png`
- `assets/images/android-icon-foreground.png`
- `assets/images/android-icon-monochrome.png`
- `public/favicon-one-more.png`
- `public/favicon.png`
- `assets/branding/one-more-splash-full-512.png`
- `public/og-one-more.png`
- `assets/branding/liftflow-icon-1024.png`
- `assets/branding/liftflow-icon-512.png`
- `assets/branding/liftflow-icon-256.png`
- `assets/branding/one-more-splash-512.png`
- `assets/branding/liftflow-logo-primary.svg`
- `assets/branding/liftflow-logo-white.svg`
- `assets/branding/liftflow-logo-black.svg`
- `assets/branding/liftflow-logo-gradient.svg`

## Screens Verified

- ✓ `src/app/index.tsx`
- ✓ `src/app/welcome.tsx`
- ✓ `src/app/(auth)/login.tsx`
- ✓ `src/app/(auth)/signup.tsx`
- ✓ `src/app/(auth)/forgot-password.tsx`
- ✓ `src/app/(tabs)/dashboard.tsx`
- ✓ `src/app/(tabs)/coaching.tsx`
- ✓ `src/app/(tabs)/workout.tsx`
- ✓ `src/app/(tabs)/nutrition.tsx`
- ✓ `src/app/(tabs)/progress.tsx`
- ✓ `src/app/(tabs)/settings.tsx`
- ✓ `src/app/(features)/subscription.tsx`
- ✓ `src/app/(features)/upgrade.tsx`
- ✓ `src/app/(onboarding)/profile.tsx`
- ✓ `src/components/auth/AuthFormContainer.tsx`
- ✓ `src/components/brand/LiftFlowLogo.tsx`
- ✓ `src/components/brand/LiftFlowWordmark.tsx`
- ✓ `public/index.html`
- ✓ `backend/src/lib/authPages.ts`
- ✓ `backend/src/lib/pdfExport.ts`

## Emails & PDFs

- `backend/src/lib/authPages.ts` — Header: ONE MORE · Footer: Only One.
- `backend/src/lib/pdfExport.ts` — Header: ONE MORE · Footer: Only One.

## Website

- `public/index.html` — Hero: YOUR TRANSFORMATION STARTS WITH ONE MORE. · Sub: Only One.
- `public/og-one-more.png` — Social preview
- `public/favicon-one-more.png` — Favicon

## Remaining Legacy References (intentional infrastructure)

These are **not** user-facing and must not change per Sprint 8.8 spec:

- Bundle ID: `com.liftflow.app`
- Expo slug / scheme: `liftflow`
- API host: `liftflow-api.onrender.com`
- Internal tokens: `LiftFlowColors`, `LiftFlowLogo` component name
- Beta invite codes: `LIFTFLOW-INTERNAL`, etc.

## Remaining Issues

- `src/app/(auth)/signup.tsx:38`
- `src/app/_layout.tsx:27`
- `src/app/why-liftflow.tsx:14`
- `src/app/why-liftflow.tsx:19`
- `src/app/why-liftflow.tsx:23`
- `src/app/why-liftflow.tsx:24`
- `src/app/why-liftflow.tsx:43`
- `src/components/insights/InsightCard.tsx:6`
- `src/components/insights/InsightCard.tsx:11`
- `src/components/onboarding/OnboardingShell.tsx:13`
- `src/components/onboarding/OnboardingShell.tsx:23`
- `src/constants/imagery.ts:6`
- `src/constants/insights/index.ts:5`
- `src/constants/insights/library.ts:1`
- `src/constants/insights/library.ts:3`
- `src/constants/insights/types.ts:9`
- `src/constants/legalContent.ts:1`
- `src/constants/legalContent.ts:32`
- `src/constants/legalContent.ts:48`
- `src/constants/legalContent.ts:60`
- `src/constants/legalContent.ts:64`
- `src/constants/subscription.ts:9`
- `src/constants/theme.ts:3`
- `src/constants/whyLiftFlow.ts:3`
- `src/constants/whyLiftFlow.ts:11`
- `src/constants/whyLiftFlow.ts:16`
- `src/constants/whyLiftFlow.ts:31`
- `src/constants/whyLiftFlow.ts:43`
- `src/constants/whyLiftFlow.ts:58`
- `src/constants/whyLiftFlow.ts:72`
- `src/constants/whyLiftFlow.ts:87`
- `src/constants/whyLiftFlow.ts:95`
- `src/constants/whyLiftFlow.ts:109`
- `src/constants/whyLiftFlow.ts:115`
- `src/hooks/useInsightRotator.ts:9`
- `src/hooks/useInsightRotator.ts:11`
- `src/hooks/useInsightRotator.ts:75`
- `src/hooks/useInsightRotator.ts:130`
- `src/hooks/useLiftFlowTheme.ts:4`
- `src/integrations/music/peakMomentStore.ts:5`
- `src/integrations/music/peakSettingsStore.ts:6`
- `src/integrations/music/playlistStateStore.ts:5`
- `src/integrations/music/playlistStateStore.ts:6`
- `src/integrations/watchOfflineQueue.ts:3`
- `src/lib/sentry.ts:9`
- `public/index.html:104`
- `public/legal/privacy.html:12`
- `public/legal/subscription-terms.html:14`
- `public/legal/support.html:11`
- `public/legal/terms.html:12`

## Validation Commands

```bash
node scripts/generate-one-more-icons.mjs
node scripts/validate-branding-enforcement.mjs
node scripts/validate-branding.mjs
```
