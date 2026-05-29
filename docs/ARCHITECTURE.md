# LiftFlow Architecture

Enterprise-grade fitness platform architecture designed for 5+ years of growth.

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Mobile App (Expo SDK 56)                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐ │
│  │ Screens  │  │  State   │  │ Services │  │  Supabase   │ │
│  │ (Router) │→ │ Contexts │→ │  Layer   │→ │   Client    │ │
│  └──────────┘  └──────────┘  └────┬─────┘  └─────────────┘ │
└───────────────────────────────────┼─────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              ┌──────────┐   ┌──────────┐   ┌──────────────┐
              │ Backend  │   │ Supabase │   │ Integrations │
              │ Express  │   │ Postgres │   │ HealthKit    │
              │ + OpenAI │   │ + Auth   │   │ Watch/Strava │
              └──────────┘   └──────────┘   └──────────────┘
```

## Directory Structure

```
src/
├── app/                    # Expo Router navigation
│   ├── (auth)/             # Login, signup, password reset
│   ├── (onboarding)/       # Legal acceptance, profile setup
│   ├── (tabs)/             # Main tabs: Workout, History, Explore, Settings
│   └── (features)/         # Dynamic placeholder routes for future features
├── api/                    # Backend API client
├── components/
│   ├── layout/             # ScreenContainer, Card, buttons, inputs
│   ├── workout/            # Mic button, workout cards, rest timer
│   ├── features/           # FeaturePlaceholderScreen
│   └── ...
├── constants/
│   ├── theme.ts            # Design system tokens
│   └── features.ts         # Feature registry (all planned capabilities)
├── contexts/               # Auth context
├── state/                  # App-wide state providers
│   └── workout/            # Active session state (MVP)
├── services/
│   ├── interfaces/         # Service contracts (IWorkoutService, etc.)
│   ├── authService.ts      # MVP: Supabase auth + mock fallback
│   ├── workoutService.ts   # MVP: placeholder data
│   └── index.ts            # Service registry
├── supabase/               # Supabase client config
├── types/                  # Domain TypeScript types (8 modules)
└── utils/                  # Placeholders, helpers

backend/src/
├── routes/                 # Domain API routes (all scaffolded)
│   ├── voice.ts            # Voice parsing (OpenAI)
│   ├── ai.ts               # Coaching, recommendations, insights
│   ├── workouts.ts         # Session CRUD, sets, rest timers
│   ├── training.ts         # Plans, phases, recovery
│   ├── nutrition.ts        # Meals, hydration, grocery
│   ├── body.ts             # Composition, photos, projections
│   ├── analytics.ts        # Dashboard, trends, snapshots
│   ├── goals.ts            # Goal tracking
│   ├── integrations.ts     # HealthKit, Watch, motion
│   ├── cardio.ts             # Cardio + heart rate
│   ├── platform.ts         # Subscriptions, ads, notifications
│   └── export.ts           # PDF, print, share
└── middleware/             # Shared middleware

supabase/
└── schema.sql              # Full enterprise schema (40+ tables)
```

## Database Schema (40+ Tables)

| Domain | Tables |
|--------|--------|
| **Core** | profiles, user_preferences, user_metrics, user_devices, legal_acceptances |
| **Exercises** | exercises, user_custom_exercises |
| **Workouts** | workout_sessions, workout_blocks, workout_exercises, workout_sets, rest_periods, workout_density_metrics |
| **Training** | training_programs, training_phases, workout_templates, planned_workouts, recovery_assessments |
| **Cardio** | cardio_sessions, heart_rate_samples |
| **Voice/AI** | voice_log_entries, ai_coaching_sessions, ai_recommendations, ai_insights |
| **Nutrition** | nutrition_goals, meal_plans, meals, grocery_lists, grocery_list_items, hydration_logs, nutrition_recommendations |
| **Body** | body_composition_records, progress_photos, photo_comparisons, physique_projections |
| **Goals/Analytics** | goals, goal_milestones, analytics_snapshots, performance_trends |
| **Integrations** | integration_connections, healthkit_sync_records, watch_sessions, motion_samples, rep_count_events, exercise_recognition_events |
| **Platform** | subscriptions, subscription_events, ad_impressions, notifications, exported_documents, share_links |

All user-owned tables have RLS policies. JSONB `metadata` columns allow extension without schema migrations.

## Service Layer

Every domain has an interface in `src/services/interfaces/`:

| Interface | MVP Status | Implementation |
|-----------|-----------|----------------|
| IAuthService | ✅ Implemented | authService.ts |
| IWorkoutService | ✅ Implemented | workoutService.ts (placeholder data) |
| IVoiceService | 🔶 Partial | Routes to backend /api/voice/parse |
| IUserService | 📋 Scaffolded | placeholderAsync |
| ITrainingService | 📋 Scaffolded | placeholderAsync |
| IAICoachingService | 📋 Scaffolded | placeholderAsync |
| ICardioService | 📋 Scaffolded | placeholderAsync |
| IIntegrationService | 📋 Scaffolded | placeholderAsync |
| INutritionService | 📋 Scaffolded | placeholderAsync |
| IBodyService | 📋 Scaffolded | placeholderAsync |
| IGoalService | 📋 Scaffolded | placeholderAsync |
| IAnalyticsService | 📋 Scaffolded | placeholderAsync |
| ISubscriptionService | 📋 Scaffolded | placeholderAsync |
| IAdService | 📋 Scaffolded | placeholderAsync |
| INotificationService | 📋 Scaffolded | placeholderAsync |
| IExportService | 📋 Scaffolded | placeholderAsync |

## Navigation Structure

```
/                           → Auth redirect
/(auth)/login               → MVP
/(auth)/signup              → MVP
/(auth)/forgot-password     → MVP
/(onboarding)/legal         → Scaffold
/(onboarding)/profile       → Scaffold
/(tabs)/workout             → MVP (active session UI)
/(tabs)/history             → MVP (placeholder data)
/(tabs)/explore             → Feature hub (all capabilities)
/(tabs)/settings            → MVP (confirmation mode, logout)
/(features)/[feature]       → Dynamic placeholder per feature ID
```

## Delivery Phases

| Phase | Features |
|-------|----------|
| **MVP** | Auth, workout UI, voice UI, history UI, settings, rest timer UI |
| **Phase 1** | Voice parsing, workout persistence, AI coaching, progression, recovery, planning |
| **Phase 2** | Cardio, heart rate, HealthKit, Apple Watch, motion/rep detection |
| **Phase 3** | Nutrition, body composition, progress photos, goals, analytics dashboard |
| **Phase 4** | Subscriptions, ads, notifications, export/PDF/print/share |

## Key Design Decisions

1. **No future schema redesign needed** — all planned features have tables, types, and service interfaces from day one.
2. **Service interface pattern** — swap mock → Supabase → API without changing screens.
3. **Dynamic feature routes** — one `[feature].tsx` route serves all 30+ placeholder screens via feature registry.
4. **JSONB metadata** — extensible fields on core tables avoid migration churn.
5. **Backend handles AI** — OpenAI keys never exposed to client; all parsing/coaching via Express API.
6. **Export infrastructure** — exported_documents + share_links tables support PDF, print, email, and privacy-controlled sharing.
7. **Integration-ready** — dedicated tables for HealthKit, Watch, motion, and rep counting with sync status tracking.

## Environment Variables

```bash
# Mobile (.env)
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_API_URL=https://liftflow-api.onrender.com

# Backend
OPENAI_API_KEY=
PORT=3000
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=          # Phase 4
```

## Legal & Compliance

- Legal onboarding flow at `/(onboarding)/legal`
- Acceptance records in `legal_acceptances` table with version tracking
- AI disclaimers on all coaching/recommendation surfaces
- Privacy levels on exports: private, shared, public
- Physique projections require disclaimer acknowledgment
