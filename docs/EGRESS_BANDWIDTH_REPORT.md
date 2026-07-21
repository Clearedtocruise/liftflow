# Supabase Bandwidth (Egress) Root Cause Analysis & Permanent Fixes

**Date:** 2026-07-17  
**Observed:** 17.49 GB used against a 5.5 GB free-tier quota (Supabase began dropping requests).  
**Goal:** Reduce monthly egress well below 5.5 GB while preserving full app functionality.

---

## Executive summary

The overrun was not caused by Realtime websockets (none found in the client). It was driven by **repeated large PostgREST reads/writes**, especially:

1. HealthKit sync downloading/upserting up to thousands of rows on every Home/History focus  
2. Dual planned-workout fetches (API + Supabase every time)  
3. Nested `SELECT *` workout session graphs reloaded during active workouts  
4. Personal-record detection downloading entire set histories on every logged set  
5. Auth profile reloads on every token refresh  

Permanent fixes are in the client: throttle/dedupe, slim selects, stop continuous HR sync, sequential planned-workout loading, signed-URL caching, and request instrumentation.

**Expected monthly savings (single active power user → typical daily usage):** **~12–16 GB → ~0.5–1.5 GB** (order-of-magnitude), bringing usage comfortably under the free tier.

---

## Issues discovered (with estimates)

| # | Issue | Est. monthly egress (1 active user) | Severity |
|---|--------|-------------------------------------|----------|
| 1 | HealthKit sync on every dashboard focus/resume + History load: fetch ≤3000 `healthkit_sync_records` + upsert batches + continuous HR (≤500/sync) | **8–12 GB** | Critical |
| 2 | `getPlannedWorkouts` always hit **API + Supabase in parallel** (Home, Workout, Nutrition, Watch, day screens) | **2–4 GB** | Critical |
| 3 | `SESSION_SELECT` nested `*` (session + exercises + exercise defs + all sets) on every `refreshSession` / hydrate / watch inbound | **1.5–3 GB** | Critical |
| 4 | `detectPersonalRecord` loaded **all** historical `workout_exercises` + **all** sets for that exercise per `logSet` | **0.5–1.5 GB** | High |
| 5 | `recalculateSessionTotals` reloaded full nested session after every set | **0.3–0.8 GB** | High |
| 6 | Auth `onAuthStateChange` re-fetched full `profiles` on `TOKEN_REFRESHED` | **0.1–0.4 GB** | Medium |
| 7 | Progress photo signed URLs regenerated on every list render (Storage API + subsequent downloads) | **0.2–1 GB** (photo heavy) | Medium |
| 8 | Watch `enrichState` re-queried recovery + planned week + recommendations on frequent pushes | **0.2–0.6 GB** | Medium |
| 9 | Broad `SELECT *` on analytics goals / history sessions | **0.1–0.3 GB** | Low–Medium |
| 10 | Realtime duplicate channels | **~0** | N/A (not used) |

Estimates assume ~20–40 Home focuses/day, 1 workout/day with ~25 sets, Watch companion active, and Health sync previously unbounded.

---

## Root causes (detail)

### 1. HealthKit → Supabase sync storm
- `dashboard.tsx` called `healthService.sync` on every load/focus/resume path.
- `history.tsx` also synced on every load.
- Each sync: device pull (limit 500 per type including continuous HR) → fetch up to **3000** existing rows → upsert → backend context refresh.
- Continuous `heart_rate` samples are high-cardinality and dominate both download and upload egress.

### 2. Double planned-workout fetch
- `trainingService.getPlannedWorkouts` used `Promise.allSettled([fromApi(), fromSupabase()])` always.
- Called from Home prefetch, Workout tab, Nutrition, day screen, Watch idle preview, companion start, etc.

### 3. Bloated workout session payloads
- `SESSION_SELECT` used `*, workout_exercises(*, exercises(*), workout_sets(*))`.
- `refreshSession` fired from Active Workout, Watch inbound, AppState resume, workout index focus — often concurrently.

### 4. PR detection O(history)
- Loaded every `workout_exercises` row for an exercise, then every `workout_sets` row — unbounded.

### 5. Auth refresh loop
- Every JWT refresh triggered `fetchProfile` (`SELECT *` on profiles) and AuthContext state updates.

### 6. Storage signed URLs
- `resolveProgressPhotoUrl` created a new signed URL on every resolve with no cache.

### 7. Realtime
- No `supabase.channel` usage in the app client — not a contributor.

---

## Code changes made

| Area | Files | Change |
|------|-------|--------|
| Instrumentation + protection | `src/lib/egressGuard.ts`, `src/supabase/client.ts` | Request dedupe, throttle helpers, spike warnings; instrumented Supabase `fetch` (counts + Content-Length when present) |
| Workout payloads | `src/services/workoutService.ts` | Explicit `SESSION_SELECT` columns; lightweight totals recalc; capped/nested PR detection; slim set/history selects; in-flight `loadSession` dedupe |
| Health sync | `src/services/healthService.ts`, `src/integrations/healthkitProvider.ts`, `src/hooks/useHealthSync.ts` | 1-hour throttle + AsyncStorage persistence; in-flight dedupe; stop syncing continuous HR; lower HealthKit limits; summaries filter low-cardinality types; manual sync uses `{ force: true }` |
| Planned workouts | `src/services/trainingService.ts` | Supabase-first (API only if empty); in-flight dedupe; explicit column select |
| Auth | `src/services/authService.ts` | Ignore `TOKEN_REFRESHED`; profile reload only on `SIGNED_IN` / `USER_UPDATED` |
| Storage | `src/lib/progressPhotoUrls.ts` | Cache signed URLs ~50 minutes; dedupe concurrent signing |
| Watch | `src/services/watchCompanionService.ts` | 90s enrich cache; idle preview throttled; deduped enrich work |
| Session refresh | `src/state/workout/WorkoutSessionContext.tsx` | Dedupe concurrent `refreshSession` for the same session |
| Analytics | `src/services/analyticsService.ts` | Narrow recent-session and goals selects |

---

## Expected monthly bandwidth savings

| Fix | Approx. savings |
|-----|-----------------|
| Health sync throttle + no continuous HR + smaller fetches | **8–12 GB** |
| Planned workouts sequential + dedupe | **2–4 GB** |
| Slim session selects + refresh dedupe + light totals | **2–4 GB** |
| PR detection cap | **0.5–1.5 GB** |
| Auth + signed URL + watch enrich caches | **0.5–2 GB** |
| **Total** | **~13–20 GB** relative to previous pathological month |

Post-fix target for a single daily active user: **well under 2 GB/month**, with headroom for Storage photos and AI/backend traffic that does not count against Supabase egress the same way.

---

## Verification checklist

- [x] No Realtime channel loops found  
- [x] Health automatic sync throttled to ≥1 hour (manual force still works)  
- [x] Continuous HR no longer written to Supabase  
- [x] Planned workouts no longer dual-fetched by default  
- [x] Session loads use explicit columns; concurrent refreshes deduped  
- [x] Auth token refresh no longer reloads profile  
- [x] Signed progress-photo URLs cached  
- [x] Watch enrich/idle preview cached/throttled  
- [x] Supabase client logs request spikes in console (`[egress] request spike`)  
- [ ] Device QA: open Home repeatedly — confirm health sync only once/hour  
- [ ] Device QA: log sets in a workout — app remains responsive; no request storm  
- [ ] Device QA: Watch companion still shows active set / rest  
- [ ] Device QA: progress photos still render  
- [ ] Monitor Supabase Dashboard egress for 24–48h after release  

---

## Follow-ups from audit agents (applied)

- Backend `loadHealthContext`: 10-minute cache, exclude continuous HR, 14-day / 500-row cap; refresh endpoint invalidates cache.
- Workout tab: removed `weekDays.length` / `session` from `loadWeekPlan` deps (stops remount refetch loop).

