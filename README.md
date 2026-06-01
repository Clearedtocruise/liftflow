# One More

Voice-first AI workout tracking and coaching platform. **Expo SDK 54** — compatible with Expo Go on iPhone (App Store).

## Quick Start

```bash
npm install
npm start
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full system design.

## What's Implemented (MVP)

- Auth screens (login, signup, password reset) with Supabase + mock fallback
- Active workout screen with mic button, exercise cards, rest timer, quick corrections
- Workout history screen with placeholder data
- Settings with voice confirmation modes
- Explore hub linking to all planned features
- Legal onboarding flow (UI scaffold)

## Architecture at a Glance

| Layer | Location | Status |
|-------|----------|--------|
| Database (40+ tables) | `supabase/schema.sql` | ✅ Ready |
| TypeScript types (8 domains) | `src/types/` | ✅ Ready |
| Service interfaces (16 domains) | `src/services/interfaces/` | ✅ Ready |
| Backend API routes | `backend/src/routes/` | ✅ Scaffolded (501) |
| Navigation + placeholders | `src/app/` | ✅ Ready |
| State management | `src/state/` | ✅ MVP |
| Feature registry | `src/constants/features.ts` | ✅ 30+ features |

## Environment

```bash
cp .env.example .env
# EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_API_URL
```

## Backend

```bash
cd backend && npm install && npm run dev
```

## Delivery Phases

1. **MVP** — Auth, workout UI, voice UI, history, settings
2. **Phase 1** — Voice parsing, persistence, AI coaching, progression, planning
3. **Phase 2** — Cardio, HealthKit, Apple Watch, motion/rep detection
4. **Phase 3** — Nutrition, body composition, photos, goals, analytics
5. **Phase 4** — Subscriptions, ads, notifications, export/PDF/share
