# ONE MORE Branding Audit — Sprint 8.8

Generated: 2026-06-01

## Summary

| Metric | Value |
|--------|-------|
| **Branding completion** | **100%** |
| Remaining LiftFlow references (non-internal) | 50 |
| Remaining RepForge references | 0 |
| User-facing LiftFlow leaks | 0 |

## Brand Configuration

| Setting | Value |
|---------|-------|
| App display name | ONE MORE |
| App Store name | One More Fitness |
| Tagline | Only One. |
| Hero headline | YOUR TRANSFORMATION STARTS WITH ONE MORE. |
| Bundle ID (unchanged) | com.liftflow.app |

## Screens Updated

- ✓ `src/app/welcome.tsx`
- ✓ `src/app/(auth)/login.tsx`
- ✓ `src/app/(auth)/signup.tsx`
- ✓ `src/app/(auth)/forgot-password.tsx`
- ✓ `src/app/(tabs)/dashboard.tsx`
- ✓ `src/app/(tabs)/settings.tsx`
- ✓ `src/app/why-liftflow.tsx`
- ✓ `src/app/(onboarding)/profile.tsx`
- ✓ `src/components/auth/AuthFormContainer.tsx`
- ✓ `public/index.html`
- ✓ `backend/src/lib/authPages.ts`
- ✓ `backend/src/lib/pdfExport.ts`

## Assets Updated

- ✓ `assets/branding/one-more-logo-primary.svg`
- ✓ `assets/branding/one-more-icon-1024.png`
- ✓ `assets/branding/one-more-icon-512.png`
- ✓ `assets/branding/one-more-icon-256.png`
- ✓ `assets/branding/one-more-splash-512.png`
- ✓ `assets/branding/liftflow-icon-1024.png`
- ✓ `assets/branding/liftflow-icon-512.png`
- ✓ `assets/branding/liftflow-icon-256.png`
- ✓ `public/favicon-one-more.png`
- ✓ `public/og-one-more.png`
- ✓ `public/one-more-mark.svg`

## Remaining LiftFlow References (non-internal)

- `backend/src/lib/betaSoak.ts:29` — .or('is_internal_tester.eq.true,beta_invite_code.eq.LIFTFLOW-INTERNAL'),
- `backend/src/lib/betaSoak.ts:63` — const internalInvite = inviteRows.find((i) => i.code === 'LIFTFLOW-INTERNAL');
- `backend/src/lib/betaSoak.ts:121` — issue: `Internal testers ${soak.internalTesters.registered}/${soak.internalTesters.target.min} — invite via LIFTFLOW-INT
- `package-lock.json:2` — "name": "liftflow",
- `package-lock.json:8` — "name": "liftflow",
- `package.json:2` — "name": "liftflow",
- `scripts/apply-pending-migrations.mjs:103` — console.log('=== LiftFlow Migration Apply ===\n');
- `scripts/beta-daily-report.mjs:51` — **Wave 1 (LIFTFLOW-BETA25):** ${wave1}
- `scripts/beta-daily-report.mjs:72` — | LIFTFLOW-INTERNAL uses | ${soak.internalTesters?.inviteUses ?? '—'} / ${soak.internalTesters?.inviteMax ?? 10} |
- `scripts/build-testflight-rc.mjs:81` — console.log('3. Invite internal testers (5–10) with LIFTFLOW-INTERNAL');
- `scripts/configure-supabase-auth-redirects.mjs:3` — * Configure Supabase Auth redirect URLs for LiftFlow mobile (no localhost).
- `scripts/configure-supabase-auth-redirects.mjs:63` — console.log('=== LiftFlow Supabase Auth Redirect Configuration ===\n');
- `scripts/create-render-service.mjs:40` — console.error('https://render.com/deploy?repo=https://github.com/Clearedtocruise/liftflow');
- `scripts/create-render-service.mjs:95` — repo: 'https://github.com/Clearedtocruise/liftflow',
- `scripts/deploy-production.mjs:129` — console.log('=== LiftFlow Production Deployment ===\n');
- `scripts/deploy-production.mjs:138` — const repoName = process.env.GITHUB_REPO ?? 'liftflow';
- `scripts/deploy-render.mjs:20` — const REPO = 'https://github.com/Clearedtocruise/liftflow';
- `scripts/deploy-render.mjs:235` — console.log('=== LiftFlow Render Deploy ===\n');
- `scripts/diagnose-migration-010.mjs:35` — password: 'LiftFlow2026!Diag',
- `scripts/github-push-via-api.mjs:16` — const repo = 'liftflow';
- `scripts/push-main-via-api.mjs:16` — const REPO = 'liftflow';
- `scripts/push-sprint87-via-api.mjs:15` — const REPO = 'liftflow';
- `scripts/seed-beta-invites.mjs:11` — { code: 'LIFTFLOW-INTERNAL', label: 'Internal testers (founder team)', max_uses: 10, is_internal: true },
- `scripts/seed-beta-invites.mjs:12` — { code: 'LIFTFLOW-BETA25', label: 'Closed beta wave 1', max_uses: 25, is_internal: false },
- `scripts/seed-beta-invites.mjs:13` — { code: 'LIFTFLOW-BETA50', label: 'Closed beta wave 2', max_uses: 50, is_internal: false },
- `scripts/setup-test-account.mjs:3` — * Create a LiftFlow test account and verify core Supabase flows.
- `scripts/setup-test-account.mjs:35` — const TEST_EMAIL = 'liftflow.tester@clearedtocruise.com';
- `scripts/setup-test-account.mjs:36` — const TEST_PASSWORD = 'LiftFlow2026!Test';
- `scripts/setup-test-account.mjs:37` — const TEST_NAME = 'LiftFlow Tester';
- `scripts/setup-test-account.mjs:75` — const probeEmail = `liftflow.probe.${Date.now()}@clearedtocruise.com`;
- `scripts/setup-test-account.mjs:215` — console.log('=== LiftFlow Test Account & Verification ===\n');
- `scripts/update-branding-sprint88.mjs:26` — /liftflow:\/\//g,
- `scripts/update-branding-sprint88.mjs:27` — /com\.liftflow\.app/g,
- `scripts/update-branding-sprint88.mjs:40` — /LiftFlowColor/g,
- `scripts/update-branding-sprint88.mjs:42` — /Approved LiftFlow mark/g,
- `scripts/update-branding-sprint88.mjs:46` — /liftflow\.app/g,
- `scripts/update-branding-sprint88.mjs:111` — out = out.replace(/LiftFlow/g, 'ONE MORE');
- `scripts/update-branding-sprint88.mjs:200` — content = content.replace(/LiftFlow/g, 'ONE MORE');
- `scripts/update-branding-sprint88.mjs:201` — // Restore protected email/domain tokens broken by LiftFlow replace
- `scripts/validate-sprint53-coach.mjs:210` — const password = 'LiftFlow2026!Validate';
- `scripts/validate-sprint85-beta-readiness.mjs:182` — Sprint 8.5 prepares LiftFlow for closed beta (25–50 users): Sentry crash reporting, in-app feedback to Supabase, product
- `scripts/validate-sprint86-testflight-rc.mjs:88` — const res = await fetch(`${url}/rest/v1/beta_invites?code=eq.LIFTFLOW-INTERNAL&select=code`, {
- `scripts/validate-sprint86-testflight-rc.mjs:93` — return { ok: Array.isArray(rows) && rows.length > 0, detail: rows.length ? 'LIFTFLOW-INTERNAL seeded' : 'not seeded' };
- `scripts/validate-sprint87-closed-beta.mjs:74` — record('LIFTFLOW-INTERNAL invite live', (soak.data?.internalTesters?.inviteMax ?? 0) > 0);
- `scripts/verify-gym-types.mjs:49` — password: 'LiftFlow2026!GymTest',
- `scripts/verify-integration.mjs:3` — * Static + API integration verification for LiftFlow coaching ecosystem.
- `scripts/verify-integration.mjs:46` — console.log('LiftFlow Integration Verification');
- `src/hooks/useInsightRotator.ts:11` — const STORAGE_KEY = 'liftflow_insight_queue';
- `src/lib/sentry.ts:9` — return process.env.EXPO_PUBLIC_SENTRY_RELEASE ?? `liftflow@${Constants.expoConfig?.version ?? '1.0.0'}`;
- `supabase/README.md:1` — # LiftFlow Supabase Setup

## Remaining RepForge References

_None._

## User-Facing LiftFlow Leaks

_None detected in app screens, components, public web, or customer emails/PDFs._

## Intentionally Unchanged (Infrastructure)

- Bundle ID: `com.liftflow.app`
- Expo slug: `liftflow`
- RevenueCat / App Store product IDs: `com.liftflow.app.premium.monthly`, `liftflow_premium_monthly`
- API host: `liftflow-api.onrender.com`
- Internal code identifiers: `LiftFlowColors`, `LiftFlowLogo`, `LiftFlowWordmark`
- Deep link scheme: `liftflow://`

## Success Criteria

Users should see only **ONE MORE** and **Only One.** throughout the application. Internal infrastructure names remain LiftFlow for backward compatibility.
