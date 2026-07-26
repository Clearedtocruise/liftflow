# LiftFlow / ONE MORE — Complete LLM Review Package

**Purpose:** Self-contained brief for another LLM (or engineer) to review product state, architecture, gaps, and planned work without prior chat context.

**Generated:** 2026-07-24  
**Repo root:** LiftFlow (branded as **ONE MORE** in product UI)  
**Primary branch observed:** `main`  
**Constraint for implementers:** Do not rebuild working systems. Extend and connect.

---

## 1. What This Product Is

LiftFlow / ONE MORE is a **voice-first AI strength coaching mobile app**:

- Log workouts by voice (and manual/watch paths)
- Generate and adapt training programs from equipment, recovery, limitations, and goals
- Coach via conversational AI (workout, recovery, nutrition)
- Track body metrics, meals, HealthKit, Apple Watch scaffolding
- Monetize via RevenueCat subscriptions (Pro gating on intelligence features)

**Not a medical device.** Legal copy and coach prompts must never diagnose or replace clinician advice.

---

## 2. Tech Stack (Authoritative)

| Layer | Stack |
|-------|--------|
| Mobile | Expo SDK **54**, Expo Router 6, React 19.1, RN 0.81.5, TypeScript |
| Backend | Node ≥20, Express 5, TypeScript, deployed on **Render** |
| Data / Auth | Supabase (Postgres + Auth + Storage + RLS) |
| AI | OpenAI (`gpt-4o-mini` and related) via backend only |
| Payments | RevenueCat (`react-native-purchases`) |
| Health | `@kingstinct/react-native-healthkit` |
| Watch | TS assistant + WatchConnectivity packages; native watchOS incomplete |
| Observability | Sentry (mobile + backend) |
| Location | `expo-location` (gym geofencing) |
| Voice | `expo-av` recording → backend `/api/voice/transcribe` (OpenAI), `expo-speech` for spoken confirmations. There is no on-device recognition: `expo-speech-recognition` is not installed, so voice needs network and a valid session. |

**Note:** Some docs say Expo SDK 56; **`package.json` is SDK 54** — trust package.json.

### Key entry points

| Role | Path |
|------|------|
| App entry | `expo-router/entry` → `src/app/_layout.tsx` |
| Auth redirect | `src/app/index.tsx` |
| Tabs | `src/app/(tabs)/` — dashboard, workout, nutrition, progress, history, settings (+ coaching/explore) |
| Features | `src/app/(features)/` |
| Backend mount | `backend/src/index.ts` |
| Schema | `supabase/schema.sql` + `supabase/migrations/` |
| Env template | `.env.example` |

---

## 3. Directory Map

```
src/
  app/           Expo Router (auth, onboarding, tabs, features)
  api/           HTTP client to Render API
  components/    UI (workout, coaching, layout)
  constants/     theme, features registry, training profile
  contexts/      Auth, subscription, etc.
  integrations/  Watch, HealthKit bridges
  services/      Domain services (Supabase + API)
  types/         Domain TypeScript models
  state/         Session / stores
backend/src/
  routes/        Express routers
  lib/           Planner, coach, substitution, recovery, programs
  middleware/    Auth, errors, Pro gate
supabase/
  schema.sql
  migrations/    002…036+ (no 001/016 in tree)
docs/            Architecture, beta, TestFlight, sprints, audits
scripts/         Migrations, QA, deploy, exercise catalog
targets/         Apple Watch target scaffolding
ios/             Native iOS / EAS prebuild
```

**Hygiene warning:** Working tree often contains Finder duplicate files (`* 2.ts`, `* 3.md`). Ignore numbered duplicates when reviewing; prefer unsuffixed canonical files.

---

## 4. Backend API Surface

Mounted in `backend/src/index.ts`:

| Prefix | Domain |
|--------|--------|
| `/health` | Health |
| `/auth`, `/legal` | Auth pages, legal |
| `/api/voice`, `/api/parse` | Voice logging |
| `/api/watch` | Watch motion/voice |
| `/api/ai` | Coach, TTS, workout generate, recommendations |
| `/api/training` | Recovery, limitations, programs, progression, coach ask |
| `/api/weekly` | Weekly closeout / summary |
| `/api/nutrition` | Meals, grocery, day sync |
| `/api/body` | Body fat estimate, transformations |
| `/api/integrations` | HealthKit, Strava, Watch |
| `/api/subscriptions` | RevenueCat webhook, restore |
| `/api/notifications` | Push register/send |
| `/api/export` | PDF export |
| `/api/outcome`, `/api/founder`, `/api/beta`, `/api/feedback`, `/api/events` | Ops / beta |
| `/api/workouts`, `/api/goals`, `/api/cardio`, `/api/analytics`, `/api/ads` | Partially scaffolded (some 501s) |

**Mobile pattern:** Prefer domain services (`src/services/*`) that call API with token fallback to direct Supabase.

---

## 5. Data Model (Major Domains)

From `supabase/schema.sql` + migrations:

### Core
`profiles`, `workout_locations`, `user_preferences`, `user_metrics`, `user_devices`, `legal_acceptances`

### Exercises / workouts
`exercises` (large catalog + `metadata.requires`, `movement_family`), `user_custom_exercises`, `workout_sessions`, `workout_blocks`, `workout_exercises`, `workout_sets`, `rest_periods`, `workout_density_metrics`

### Training / coach
`training_programs`, `training_phases`, `workout_templates`, `planned_workouts`, `recovery_assessments`, **`training_limitations`**, **`weekly_coach_check_ins`**

### Nutrition / body
`nutrition_goals`, `meal_plans`, `meals`, `grocery_*`, `hydration_logs`, `body_composition_records`, `progress_photos`, projections

### Integrations
`healthkit_sync_records`, `watch_sessions`, `motion_samples`, `rep_count_events`, `exercise_recognition_events`, `integration_connections`

### Platform
`subscriptions`, `notifications`, `exported_documents`, beta tables (`beta_feedback`, etc.)

### Migration 007 (coach foundation) — injury-related columns/tables
- `recovery_assessments`: `check_in_date`, sleep/stress scores, `recovery_score`, `daily_recommendation`, `recovery_mode_active`
- `weekly_coach_check_ins`
- `training_limitations` with enum `limitation_type`: `injury | pain | tightness | mobility | discomfort`

---

## 6. Mobile Services (Canonical)

Important files under `src/services/` (ignore `* 2.ts` duplicates):

| Service | Role |
|---------|------|
| `workoutService.ts` | Sessions, sets, active workout |
| `voiceService.ts` / `voiceCoachingService.ts` | Parse + coach TTS |
| `aiService.ts` | Recommendations, generate workout, askCoach |
| `limitationService.ts` | CRUD training limitations |
| `recoveryService.ts` | Daily recovery check-ins / trends |
| `workoutLocationService.ts` / `deviceLocationService.ts` | Multi-gym + GPS |
| `nutritionService.ts` / `nutritionIntelligenceService.ts` | Meals, adaptive macros |
| `watchWorkoutService.ts` / `watchCompanionService.ts` | Watch assistant |
| `subscriptionService.ts` | RevenueCat |
| `healthService.ts` / `integrationService.ts` | HealthKit / bridges |
| `trainingService.ts` / `progressionService.ts` / `adaptationService.ts` | Programs & progression |
| `weeklyCloseoutService.ts` / `coachCheckInService.ts` | Weekly loops |
| `conversationalCoachService.ts` | Chat coach |

Types for coach/recovery/limitations: `src/types/coaching.ts`.

---

## 7. Feature Screens of Note

| Route | Purpose |
|-------|---------|
| `/(tabs)/workout` | Active workout + voice + start prompt / gym |
| `/(tabs)/coaching` | AI recommendations / generate |
| `/(tabs)/nutrition` | Macros, meals, grocery |
| `/(tabs)/progress` | Photos, measurements |
| `/(tabs)/history` | Session history |
| `/(features)/limitations` | Add/resolve pain/injury limitations |
| `/(features)/recovery-check-in` | Daily recovery |
| `/(features)/weekly-check-in` | Weekly coach check-in |
| `/(features)/apple-watch` | Phone-side watch assistant / sim |
| `/(features)/training-profile` | Gyms / equipment |
| `/(features)/program*` | Program calendar / create |
| `/(features)/coach-chat` | Conversational coach |
| `/(features)/subscription` | Paywall |

---

## 8. Coaching / Injury Architecture (CURRENT CODE)

### 8.1 Unified limitations model (already exists)

**One system, two semantics:**

| Concept | How modeled |
|---------|-------------|
| **Injuries** | `limitation_type = 'injury'`, often `is_diagnosed = true`, longer-lived |
| **Limitations** | `pain`, `tightness`, `mobility`, `discomfort` — episodic or chronic |

Table: `training_limitations`  
UI: `/(features)/limitations` + onboarding chips in `/(onboarding)/profile`  
API: `GET/POST /api/training/limitations`, `PATCH /api/training/limitations/:id`  
Service: `limitationService.ts`

### 8.2 Substitution engine (already exists)

`backend/src/lib/exerciseSubstitution.ts`:

- Shoulder → block barbell bench / OHP → Neutral Grip DB Press, Machine Press, Push-Up, etc.
- Lower back → block conventional DL / back squat → Trap Bar, Hip Thrust, Leg Press, light RDL
- Knee → Split Squat, Leg Press, Step-Up, partial Goblet
- Elbow / hip / wrist rules similarly

Also: `equipmentSubstitutionEngine.ts`, `exerciseReplacementEngine.ts` for equipment/location swaps.

### 8.3 Recovery Mode (already exists)

- Stored on `recovery_assessments.recovery_mode_active`
- Check-in POST `/api/training/recovery/check-in` computes score; activates mode when score &lt; 40 (and/or subjective flag)
- Influences nutrition day sync (`nutritionDaySync.ts` reads `recovery_mode_active`)
- Types: `DailyRecoveryCheckIn` in `src/types/coaching.ts`

### 8.4 What the injury directive still wants (gaps vs full vision)

Even with foundation shipped, full directive may still lack:

- Dedicated **pain check-in history / trends charts** separate from recovery
- **Pre-workout pain gate** (0–10 + location) before every session
- **Substitution audit table** (`injury_exercise_substitutions`) with UI on WorkoutCard
- **Voice/Watch** “My shoulder hurts” → auto-create limitation + severity prompt (partial/unverified end-to-end)
- **Escalation** for worsening pain (3 rising scores → professional evaluation CTA)
- **Start/expected recovery dates**, PT notes fields on profile (metadata may hold some; verify)
- Native **watchOS** hands-free execution (phone scaffolding only)

**Safety (required everywhere):** Never diagnose; never replace medical advice; modifications + volume reduction only; escalate on high/worsening pain.

---

## 9. Other Major Engines (Backend `lib/`)

| Module | Role |
|--------|------|
| `workoutPlanner.ts` | Equipment-aware adaptive plans, rotation by `movement_family` |
| `aiCoach.ts` | Recommendations, meal templates, coach responses, generate workout |
| `programEngine.ts` / `adaptiveProgram.ts` | Multi-week program generation/adaptation |
| `coachContext.ts` / `conversationalCoachEngine.ts` | Smart coach Q&A context |
| `loadRecoveryIntelligence.ts` | Recovery intelligence for Pro |
| `loadSmartProgression.ts` | Progression suggestions |
| `loadNutritionIntelligence.ts` | Workout-aware nutrition |
| Watch: `watchWorkoutEngine.ts` + mobile `src/integrations/watch/*` | Rep profiles, voice commands |

---

## 10. Environment Variables (Names Only)

See `.env.example`. Critical:

- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_API_URL` (Render)
- `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (backend)
- `EXPO_PUBLIC_REVENUECAT_*`, `REVENUECAT_WEBHOOK_SECRET`
- Strava, Sentry, EAS, Founder admin keys as needed

**Never commit `.env`.**

---

## 11. Product Audits Summary (Conversation + Docs)

Treat these as **planning truth**, then **verify against current code** (code has moved ahead of May 2026 launch audit in several areas).

### 11.1 Feature coverage (broad target list)

Rough readiness from last full checklist review (adjust after spot-checks):

| Bucket | Examples | Typical state |
|--------|----------|---------------|
| Strong | Auth, voice log, AI generate, photos, macros, locations GPS, Pro gates, recovery check-in, limitations CRUD, programs | Mostly built |
| Partial | Manual set edit UI, history detail, rest timer live, charts, Watch native, workout-aware nutrition polish | Partial |
| Weak / missing | Full PR analytics, some notification types, advanced Watch motion on wrist | Gaps |

Historical snapshot (May `docs/LAUNCH_READINESS_AUDIT.md`): ~74% launch / ~82% TestFlight for a **narrower** MVP list. Broader feature matrix was lower (~58% / ~72% / ~48% AI coach) — **re-score after current code review**.

### 11.2 Enhancement directive (extend, don’t rebuild)

Priority order previously recommended:

1. Location → planner equipment wire + gym intelligence UX  
2. Recovery score → planner/nutrition  
3. Smart coach context  
4. Exercise education  
5. Workout-aware nutrition + daily meals  
6. Weekly check-in charts  
7. Native Watch  

### 11.3 Injury system integration audit (planning)

**Architecture decision:** Injuries + limitations = **same system** (`training_limitations`), not two apps.

**Recovery Mode** multiplies volume/intensity and feeds nutrition + weekly coach.

**Voice/Watch flow (target):**

```
Utterance → parse symptom intent → training_limitations (+ optional severity)
  → exerciseSubstitution / planner
  → coach context refresh
  → user-facing disclaimer
```

**Estimated remaining hours** for full injury vision beyond current foundation: historically ~74–106h MVP remaining / ~134–184h full — **re-estimate** now that limitations + substitution + recovery mode exist (likely lower).

---

## 12. Apple Watch Status

| Layer | Status |
|-------|--------|
| Motion profiles + phone rep counter | Yes (`src/integrations/watch/`) |
| Voice Q&A (reps/sets/weight) | Yes (phone + API) |
| Backend `/api/watch/*` | Yes |
| Native watchOS UI + CoreMotion on wrist | Incomplete (`docs/WATCH_NATIVE.md`, `docs/WATCH_ARCHITECTURE.md`) |
| Symptom logging on Watch | Target / verify |

**Verdict:** Advanced Watch tracking is **partially done on phone**, not a finished hands-free Watch product.

---

## 13. Safety & Compliance Checklist for Reviewers

When reviewing AI/injury/coach code, verify:

1. No diagnosis language in prompts or UI labels  
2. “Not medical advice” on limitations / recovery / coach  
3. Escalation path for pain ≥7 or worsening trends  
4. Substitutions preserve `movement_family` / training intent  
5. Progression does not blindly +5 lbs under Recovery Mode / high pain  
6. User-scoped progression queries (historical bug: progression API without `user_id` filter — verify fixed)  
7. Privacy: HealthKit / location permissions explained  

Legal: `src/constants/legalContent.ts`, `docs/store/*`, `public/legal/*`

---

## 14. How Another LLM Should Review This Repo

### Suggested review modes

1. **Architecture review** — Does service → API → Supabase layering hold? Any rebuild smell?  
2. **Injury/coaching completeness** — Trace limitation create → substitution → planned workout → session.  
3. **Security** — RLS, service role usage, auth on routes, webhook secrets, user scoping.  
4. **Launch readiness** — Compare `docs/BETA_*`, `RELEASE_CHECKLIST.md`, RevenueCat/ASC gaps.  
5. **Watch** — Separate native vs phone paths.  
6. **Data hygiene** — Duplicate files, migration gaps (missing 001/016), schema.sql vs migrations drift.

### High-value files to read first

```
README.md
docs/ARCHITECTURE.md
docs/LAUNCH_READINESS_AUDIT.md
docs/WATCH_NATIVE.md
docs/BETA_LAUNCH_CHECKLIST.md
supabase/migrations/007_sprint2_coach_foundation.sql
backend/src/lib/workoutPlanner.ts
backend/src/lib/exerciseSubstitution.ts
backend/src/lib/aiCoach.ts
backend/src/routes/training.ts
src/services/limitationService.ts
src/services/workoutService.ts
src/types/coaching.ts
src/app/(features)/limitations.tsx
src/app/(tabs)/workout/
app.config.ts
package.json
backend/package.json
.env.example
```

### Commands useful for reviewers (local)

```bash
# Typecheck mobile
npx tsc --noEmit

# Backend
cd backend && npm test   # if configured
```

---

## 15. Implementation Principles (For Agents)

1. **Do not rebuild** planner, voice, Supabase session model, or RevenueCat.  
2. **Extend** `training_limitations`, `exerciseSubstitution`, `recovery_assessments`, `workoutPlanner`.  
3. Prefer **migrations** over editing only `schema.sql` (keep both in sync).  
4. Keep AI outputs as **ModificationPlan** style JSON (substitutions, multipliers) — not diagnoses.  
5. Ship UI banners for Recovery Mode with plain-language **why**.  
6. Ignore Finder duplicate `* N.*` files; delete only if user asks.  

---

## 16. Known Product Gaps (Living List)

Verify each before treating as open work:

- [ ] Pre-workout pain gate on start workout  
- [ ] Pain trend charts / recovery timeline UI  
- [ ] Substitution footnotes on active WorkoutCard  
- [ ] Voice/Watch symptom intents end-to-end  
- [ ] Native watchOS + live motion  
- [ ] Full exercise education (instructions/video per exercise UI)  
- [ ] Manual set edit / pause-resume polish (if still incomplete)  
- [ ] History session detail navigation (vs delete-on-tap regressions)  
- [ ] ASC + RevenueCat sandbox E2E  
- [ ] Progression API user scoping  

---

## 17. Branding

- Internal project / package name: **liftflow**  
- Consumer brand: **ONE MORE** (see `ONE_MORE_BRANDING_AUDIT.md`, `BRANDING_AUDIT.md`)  
- Bundle / product IDs may still use `com.liftflow.app.*`  

---

## 18. One-Paragraph Elevator for Reviewers

> ONE MORE (LiftFlow) is an Expo 54 + Supabase + Express/OpenAI coaching app with multi-gym GPS, equipment-aware program generation, recovery check-ins with Recovery Mode, unified training limitations (injury/pain/etc.) with rule-based exercise substitution, voice workout logging, conversational coach, nutrition intelligence, HealthKit, RevenueCat Pro, and a phone-side Apple Watch assistant. Schema and engines are far ahead of a greenfield MVP; remaining work is primarily **connecting**, **hardening**, and **finishing UX** (especially Watch native, pain workflows, analytics, and store ops)—not rewriting core architecture.

---

## 19. Related Docs Index

| Doc | Use |
|-----|-----|
| `docs/ARCHITECTURE.md` | System overview |
| `docs/LAUNCH_READINESS_AUDIT.md` | May launch checklist (partially stale) |
| `docs/BETA_*.md` | Beta ops |
| `docs/WATCH_*.md` | Watch plan |
| `docs/REVENUECAT_SETUP_GUIDE.md` | Billing setup |
| `docs/HEALTHKIT_REQUIREMENTS.md` | Health entitlements |
| `docs/store/*` | ASC listing + legal |
| `docs/LLM_REVIEW_PACKAGE.md` | **This file** |

---

*End of package. Paste this file (or the whole `docs/` + `src/` + `backend/` + `supabase/` trees) into another LLM for review. Prefer this document as the index; use source files as evidence.*
