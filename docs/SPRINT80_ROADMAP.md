# Sprint 8.0 — Roadmap (Implementation Blocked Until Sprint 7.9 Gate PASS)

**Prerequisite:** `node scripts/validate-sprint79-final-gate.mjs` → **PASS** + Beta Readiness **100/100**

Current gate status: see [SPRINT79_FINAL_GATE_REPORT.md](./SPRINT79_FINAL_GATE_REPORT.md)

---

## Priority 1 — Transformation Engine

**Goal:** Show users what they can become.

### Build

| Component | Source data |
|-----------|-------------|
| Before / current photos | `progress_photos` |
| Progress timeline | Photo dates + body composition records |
| Body fat / lean / fat mass | `bodyService`, `/api/body/estimate-body-fat` |
| Projections (20/15/12/10% BF) | Weight trend + BF estimate + adherence signals |

### Projection system

- Store projection runs in `transformation_projections` (new migration)
- Inputs: current weight, estimated BF%, lean mass, weekly adherence, success score
- Outputs: projected weight, lean mass, fat mass at target BF%
- UI: Before | Current | Projected side-by-side

### Integrations

- Success score (`outcome_intelligence`)
- Weight trend (`weekly_coach_check_ins`, body records)
- Nutrition / workout adherence

### Voice

- "Show my projection" → `transformation_query`
- "What will I look like at 12% body fat?" → `transformation_target_bf`

### Existing foundation

- `bodyService`, progress photos, body fat API partially exist — extend, do not duplicate analytics dashboards.

---

## Priority 2 — Peak Music Sync

**Goal:** Sync workout intensity with music intensity.

### Status (Sprint 7.X)

Architecture complete: types, provider registry, continuity engine, settings, voice patterns. **Phase 2:** OAuth + native SDKs.

### Playback modes

1. Return to previous playlist — snapshot → peak → restore  
2. Continue from peak song — no restore  
3. Workout mode queue — rest / build-up / peak / PR roles  

### Provider feasibility

| Provider | Modes 1–2 | Mode 3 | ToS notes |
|----------|-----------|--------|-----------|
| Apple Music | High | High | MusicKit; user-owned peaks only |
| Spotify | High | Medium | Premium + App Remote; no audio analysis |
| Amazon Music | Not feasible | Not feasible | No playback API |
| Pandora | Low | Low | Station model |

See [PLAYLIST_CONTINUITY.md](./PLAYLIST_CONTINUITY.md), [PEAK_MUSIC_SYNC.md](./PEAK_MUSIC_SYNC.md).

**Do not:** Analyze copyrighted audio; manipulate queues beyond provider APIs.

---

## Priority 3 — Apple Watch Experience

**Goal:** Operate without touching the phone.

### Architecture (companion, not standalone Watch app v1)

```
iPhone (LiftFlow) ←→ WatchConnectivity / HealthKit
  ├── Session state sync
  ├── Rest timer commands
  ├── Voice → iPhone STT → log set
  └── HR / HRV / sleep from HealthKit → recovery engine
```

### Watch surfaces (Phase 2)

- Active workout + rest timer
- Last set / next progression line
- Recovery score badge
- "Start today's workout" from recommendations

### Requirements

- HealthKit entitlement on production iOS build (not Expo Go)
- `UIBackgroundModes`: audio if voice on Watch
- App Store: privacy strings for Health, microphone
- Document: [HealthKit dev build steps](./RELEASE_CHECKLIST.md#6-integration-smoke)

Existing: `backend/src/routes/watch.ts`, `@kingstinct/react-native-healthkit`, health sync engine.

---

## Priority 4 — RevenueCat & Subscriptions

### Tiers

| Free | Pro |
|------|-----|
| Workout logging | AI Coach |
| Basic history | Recovery Intelligence |
| Progress tracking | Nutrition Intelligence |
| | Smart Progression |
| | Transformation Engine |
| | Peak Music Sync |
| | Advanced Watch features |

### Implementation

- `react-native-purchases` (already in package.json)
- Entitlement IDs: `pro` or per-feature flags
- `useSubscription` hook + `FeatureGate` component
- Paywall screens: onboarding + settings upgrade
- Trial: RevenueCat introductory offer
- Server: optional webhook to Supabase `subscriptions` table

Env: `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`, App Store Connect products linked.

---

## Priority 5 — Beta User Readiness (25–50 users)

Deliverables:

- [ ] Beta checklist (extend [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md))
- [ ] Known issues doc
- [ ] Crash reporting (Sentry or Expo Updates + manual TestFlight feedback)
- [ ] In-app feedback (Settings → "Send feedback" → email or API)
- [ ] Release notes template
- [ ] App Store readiness report

Scores:

- **Beta Readiness Score** — `validate-sprint79-final-gate.mjs`
- **Launch Readiness Score** — Sprint 8.0 final validator (TBD)

---

## Priority 6 — Final Validation (Sprint 8.0 exit)

Script: `scripts/validate-sprint80-launch.mjs` (to create after gate PASS)

| Area | Validator |
|------|-----------|
| Auth | Sprint 7.8 feature checks |
| Workouts / voice | Sprint 7.0 |
| AI Coach | Sprint 7.6 |
| Recovery / nutrition | 7.2 / 7.5 |
| Smart progression | Sprint 7.1 |
| Transformation | Sprint 8.1 |
| Peak music | Sprint 7.X |
| Apple Health | Sprint 7.4 |
| Watch architecture | Static + dev build |
| RevenueCat | Entitlement E2E |
| Founder dashboard | `/admin/founder` |

Output: PASS/FAIL report, release blockers, recommended launch date, production readiness score.

---

## Recommended implementation order (after gate PASS)

1. RevenueCat gates (monetization foundation)
2. Transformation Engine (differentiation)
3. Peak Music Phase 2 (Apple → Spotify)
4. Watch companion sync
5. Beta readiness pack
6. Launch validation

**Estimated launch:** 2–4 weeks after gate PASS + TestFlight soak (assuming production deploy and migrations resolved).
