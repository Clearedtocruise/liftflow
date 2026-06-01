# Sprint 8.7 — Execution Status

**Date:** 2026-05-31  
**Validator:** PASS 16/16 (`npm run validate:sprint87`)  
**Phase:** Internal soak — Day 0

---

## Completed (automated)

| Item | Status |
|------|--------|
| Beta soak APIs deployed (Render) | ✓ live |
| `npm run beta:daily-report` | ✓ first report generated |
| `npm run build:testflight-rc -- --dry-run` | ✓ preflight 6/6 |
| Sprint 8.7 pushed to GitHub | [2476f32](https://github.com/Clearedtocruise/liftflow/commit/2476f32169e0fa1dd9fa292a7e515a24b8b2f54e) |
| Backend redeployed | ✓ soak-status, retention, launch-blockers |

---

## Current gate status

| Metric | Value |
|--------|-------|
| P0 | 0 |
| P1 | 4 (expected pre-soak) |
| Internal testers | 0 / 5–10 |
| Wave 1 (LIFTFLOW-BETA25) | **NOT AUTHORIZED** |
| Expand to 50 | Not yet |

**P1 blockers (expected until soak starts):**
- Internal testers 0/5
- No workout / voice / coach soak events yet

---

## Manual ops (founder)

### 1. TestFlight RC build + upload

```bash
npm run build:testflight-rc          # Preflight + EAS build (~20 min)
npm run submit:ios                     # Submit to App Store Connect
```

Then in **App Store Connect → TestFlight**: confirm build processing completes.

### 2. Invite internal testers (5–10)

- Share TestFlight link
- Invite code: `LIFTFLOW-INTERNAL`
- Track progress: [SPRINT87_INTERNAL_SOAK_TRACKER.md](./SPRINT87_INTERNAL_SOAK_TRACKER.md)

### 3. Execute soak plan (each tester)

Login → Workout → Voice → AI Coach → Recovery → Nutrition → Transformation → Peak Music → RevenueCat → HealthKit → Watch → Feedback

### 4. Daily monitoring

```bash
npm run beta:daily-report
```

Dashboards: Sentry · OpenAI · RevenueCat · Render · `/admin/founder`

---

## Wave 1 authorization

**Do not issue `LIFTFLOW-BETA25` until:**

- Zero P0
- Zero recurring P1
- 5–10 internal testers complete soak
- `npm run beta:daily-report` shows **Wave 1: AUTHORIZED**

See [SPRINT87_WAVE1_AUTHORIZATION.md](./SPRINT87_WAVE1_AUTHORIZATION.md)

---

## Reports

| Report | Path |
|--------|------|
| Daily status | [docs/reports/BETA_DAILY_2026-05-31.md](./reports/BETA_DAILY_2026-05-31.md) |
| Launch blockers | [SPRINT87_LAUNCH_BLOCKERS.md](./SPRINT87_LAUNCH_BLOCKERS.md) |
| Validation | [SPRINT87_VALIDATION_REPORT.md](./SPRINT87_VALIDATION_REPORT.md) |

Re-run daily: `npm run beta:daily-report`
