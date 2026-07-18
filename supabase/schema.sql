-- =============================================================================
-- LiftFlow Enterprise Database Schema
-- =============================================================================
-- Version: 2.0.0
-- Designed for 5+ year scalability. All user-owned tables include user_id,
-- timestamps, and RLS. JSONB metadata columns allow extension without migrations.
--
-- Run order: extensions → enums → tables → indexes → RLS → functions
-- =============================================================================

-- Extensions
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- =============================================================================
-- ENUMS
-- =============================================================================

create type public.training_experience as enum ('beginner', 'intermediate', 'advanced', 'elite');
create type public.confirmation_mode as enum ('always', 'smart', 'none');
create type public.legal_document_type as enum ('terms', 'privacy', 'liability', 'ai_disclaimer', 'health_disclaimer');
create type public.movement_category as enum ('push', 'pull', 'squat', 'hinge', 'carry', 'cardio', 'core', 'other');
create type public.exercise_type as enum ('strength', 'bodyweight', 'timed', 'cardio');
create type public.set_type as enum ('normal', 'warmup', 'dropset', 'failure', 'rest_pause', 'amrap', 'tempo');
create type public.block_type as enum ('standard', 'superset', 'giant_set', 'circuit', 'drop_set', 'rest_pause');
create type public.session_status as enum ('planned', 'active', 'paused', 'completed', 'cancelled');
create type public.phase_type as enum ('hypertrophy', 'strength', 'power', 'endurance', 'deload', 'maintenance', 'cut', 'custom');
create type public.recovery_status as enum ('optimal', 'moderate', 'fatigued', 'overreached', 'unknown');
create type public.cardio_type as enum ('run', 'walk', 'cycle', 'row', 'swim', 'hiit', 'treadmill', 'elliptical', 'other');
create type public.meal_type as enum ('breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout');
create type public.goal_type as enum ('strength', 'endurance', 'body_composition', 'weight_loss', 'muscle_gain', 'habit', 'custom');
create type public.goal_status as enum ('active', 'completed', 'paused', 'abandoned');
create type public.subscription_tier as enum ('free', 'premium', 'premium_plus');
create type public.subscription_status as enum ('active', 'trialing', 'past_due', 'cancelled', 'expired');
create type public.notification_type as enum ('workout_reminder', 'rest_timer', 'coaching', 'goal', 'recovery', 'subscription', 'system');
create type public.export_format as enum ('pdf', 'csv', 'json', 'print');
create type public.export_content_type as enum (
  'workout', 'workout_plan', 'training_report', 'analytics_dashboard',
  'meal_plan', 'grocery_list', 'progress_summary', 'body_composition',
  'goal_report', 'coaching_summary', 'custom'
);
create type public.integration_provider as enum ('apple_healthkit', 'apple_watch', 'strava', 'google_fit');
create type public.sync_status as enum ('pending', 'syncing', 'synced', 'failed');
create type public.ai_recommendation_type as enum (
  'workout', 'exercise', 'weight', 'reps', 'rest', 'recovery',
  'muscle_group', 'training_phase', 'nutrition', 'hydration', 'coaching_insight'
);
create type public.voice_command_status as enum ('pending', 'parsed', 'confirmed', 'rejected', 'failed');
create type public.ad_placement as enum ('home', 'history', 'settings', 'post_workout');
create type public.photo_angle as enum ('front', 'back', 'side_left', 'side_right', 'custom');

-- =============================================================================
-- CORE: USERS & PREFERENCES
-- =============================================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  date_of_birth date,
  sex text check (sex in ('male', 'female', 'other', 'prefer_not_to_say')),
  height_cm numeric(5,2),
  weight_kg numeric(5,2),
  body_fat_pct numeric(4,2),
  training_experience public.training_experience default 'beginner',
  fitness_goals text[] default '{}',
  preferred_units text not null default 'imperial' check (preferred_units in ('imperial', 'metric')),
  preferred_height_unit text not null default 'ft_in' check (preferred_height_unit in ('ft_in', 'in', 'cm')),
  preferred_weight_unit text not null default 'lb' check (preferred_weight_unit in ('lb', 'kg')),
  preferred_distance_unit text not null default 'mi' check (preferred_distance_unit in ('mi', 'km')),
  preferred_measurement_unit text not null default 'in' check (preferred_measurement_unit in ('in', 'cm')),
  preferred_water_unit text not null default 'oz' check (preferred_water_unit in ('oz', 'L')),
  confirmation_mode public.confirmation_mode not null default 'smart',
  timezone text default 'UTC',
  training_location text check (training_location in (
    'home_gym',
    'garage_gym',
    'commercial_gym',
    'planet_fitness',
    'full_gym'
  )),
  primary_gym_name text,
  available_equipment text[] not null default '{}',
  primary_training_goal text check (primary_training_goal in ('fat_loss', 'muscle_gain', 'strength', 'general_fitness')),
  onboarding_completed boolean not null default false,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.workout_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  location_type text not null check (location_type in ('home_gym', 'commercial_gym')),
  available_equipment text[] not null default '{}',
  is_default boolean not null default false,
  sort_order integer not null default 0,
  notes text,
  latitude double precision,
  longitude double precision,
  radius_meters integer not null default 150,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade unique,
  rest_timer_sound boolean default true,
  rest_timer_haptics boolean default true,
  voice_feedback boolean default true,
  show_ads boolean default true,
  share_analytics boolean default false,
  printer_friendly_default boolean default true,
  notification_preferences jsonb not null default '{}',
  coaching_preferences jsonb not null default '{}',
  privacy_settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  weight_kg numeric(5,2),
  height_cm numeric(5,2),
  body_fat_pct numeric(4,2),
  muscle_mass_kg numeric(5,2),
  resting_heart_rate integer,
  vo2_max numeric(4,1),
  source text default 'manual',
  notes text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_token text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  device_name text,
  is_active boolean default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_type public.legal_document_type not null,
  version text not null,
  ip_address inet,
  user_agent text,
  accepted_at timestamptz not null default now()
);

-- =============================================================================
-- EXERCISE LIBRARY
-- =============================================================================

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  category public.movement_category not null,
  exercise_type public.exercise_type not null default 'strength',
  equipment text not null,
  muscle_groups text[] not null default '{}',
  secondary_muscles text[] default '{}',
  tutorial_url text,
  instructions text,
  is_system boolean not null default false,
  created_by uuid references public.profiles(id),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_custom_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  custom_name text,
  notes text,
  created_at timestamptz not null default now(),
  unique(user_id, exercise_id)
);

-- =============================================================================
-- WORKOUTS: SESSIONS, BLOCKS, SETS, TIMERS
-- =============================================================================

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  status public.session_status not null default 'active',
  planned_workout_id uuid,
  training_phase_id uuid,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer,
  total_volume numeric(12,2),
  total_sets integer default 0,
  calories_burned integer,
  notes text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workout_blocks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  block_type public.block_type not null default 'standard',
  sort_order integer not null default 0,
  rest_seconds integer,
  notes text,
  created_at timestamptz not null default now()
);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  block_id uuid references public.workout_blocks(id) on delete set null,
  exercise_id uuid not null references public.exercises(id),
  sort_order integer not null default 0,
  suggested_weight numeric(8,2),
  suggested_reps text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references public.workout_exercises(id) on delete cascade,
  set_number integer not null,
  weight numeric(8,2),
  reps integer,
  rpe numeric(3,1),
  "set_type" public.set_type not null default 'normal',
  duration_seconds integer,
  time_under_tension_seconds integer,
  rest_seconds integer,
  is_pr boolean default false,
  notes text,
  logged_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table public.rest_periods (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  workout_set_id uuid references public.workout_sets(id) on delete set null,
  recommended_seconds integer,
  actual_seconds integer,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  was_skipped boolean default false
);

create table public.workout_density_metrics (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade unique,
  total_work_seconds integer,
  total_rest_seconds integer,
  sets_per_minute numeric(5,2),
  volume_per_minute numeric(10,2),
  density_score numeric(5,2),
  calculated_at timestamptz not null default now()
);

-- =============================================================================
-- TRAINING: PLANS, PHASES, TEMPLATES, RECOVERY
-- =============================================================================

create table public.training_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  duration_weeks integer,
  is_active boolean default false,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.training_phases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  program_id uuid references public.training_programs(id) on delete set null,
  name text not null,
  phase_type public.phase_type not null,
  start_date date not null,
  end_date date,
  target_muscle_groups text[] default '{}',
  notes text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  muscle_groups text[] default '{}',
  estimated_duration_minutes integer,
  exercises jsonb not null default '[]',
  is_system boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.planned_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  template_id uuid references public.workout_templates(id),
  training_phase_id uuid references public.training_phases(id),
  name text not null,
  scheduled_date date not null,
  scheduled_time time,
  status public.session_status default 'planned',
  suggested_muscle_groups text[] default '{}',
  ai_rationale text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.recovery_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  assessed_at timestamptz not null default now(),
  status public.recovery_status not null,
  sleep_hours numeric(3,1),
  soreness_score integer check (soreness_score between 1 and 10),
  energy_score integer check (energy_score between 1 and 10),
  hrv_ms numeric(6,2),
  muscle_groups text[] default '{}',
  ai_analysis text,
  recommendations jsonb default '[]',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- =============================================================================
-- CARDIO & HEART RATE
-- =============================================================================

create table public.cardio_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  workout_session_id uuid references public.workout_sessions(id) on delete set null,
  cardio_type public.cardio_type not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer,
  distance_meters numeric(10,2),
  calories_burned integer,
  avg_pace_sec_per_km numeric(8,2),
  avg_heart_rate integer,
  max_heart_rate integer,
  elevation_gain_m numeric(8,2),
  notes text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.heart_rate_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid,
  session_type text check (session_type in ('workout', 'cardio', 'rest', 'daily')),
  recorded_at timestamptz not null default now(),
  bpm integer not null,
  source text default 'manual',
  metadata jsonb not null default '{}'
);

-- =============================================================================
-- VOICE & AI
-- =============================================================================

create table public.voice_log_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid references public.workout_sessions(id) on delete set null,
  raw_transcript text not null,
  audio_url text,
  status public.voice_command_status not null default 'pending',
  confidence numeric(4,3),
  parsed_data jsonb,
  created_at timestamptz not null default now()
);

create table public.ai_coaching_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_type text not null default 'general',
  prompt_context jsonb not null default '{}',
  response text not null,
  citations jsonb default '[]',
  model_version text,
  tokens_used integer,
  created_at timestamptz not null default now()
);

create table public.ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  recommendation_type public.ai_recommendation_type not null,
  title text not null,
  description text not null,
  rationale text,
  evidence_citations jsonb default '[]',
  payload jsonb not null default '{}',
  confidence numeric(4,3),
  is_accepted boolean,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  insight_type text not null,
  title text not null,
  body text not null,
  educational_content text,
  research_citations jsonb default '[]',
  related_session_ids uuid[] default '{}',
  is_read boolean default false,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- NUTRITION
-- =============================================================================

create table public.nutrition_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  daily_calories integer,
  protein_g integer,
  carbs_g integer,
  fat_g integer,
  water_ml integer,
  is_active boolean default true,
  effective_from date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  week_start_date date not null,
  ai_generated boolean default false,
  ai_rationale text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid references public.meal_plans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  meal_type public.meal_type not null,
  name text not null,
  scheduled_date date,
  calories integer,
  protein_g numeric(6,1),
  carbs_g numeric(6,1),
  fat_g numeric(6,1),
  instructions text,
  created_at timestamptz not null default now()
);

create table public.grocery_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  meal_plan_id uuid references public.meal_plans(id) on delete set null,
  name text not null,
  week_start_date date,
  created_at timestamptz not null default now()
);

create table public.grocery_list_items (
  id uuid primary key default gen_random_uuid(),
  grocery_list_id uuid not null references public.grocery_lists(id) on delete cascade,
  name text not null,
  quantity numeric(8,2),
  unit text,
  category text,
  is_checked boolean default false,
  sort_order integer default 0
);

create table public.hydration_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  logged_at timestamptz not null default now(),
  amount_ml integer not null,
  source text default 'manual'
);

create table public.nutrition_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null,
  rationale text,
  evidence_citations jsonb default '[]',
  payload jsonb default '{}',
  created_at timestamptz not null default now()
);

-- =============================================================================
-- BODY COMPOSITION & PROGRESS
-- =============================================================================

create table public.body_composition_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  weight_kg numeric(5,2),
  body_fat_pct numeric(4,2),
  lean_mass_kg numeric(5,2),
  waist_cm numeric(5,2),
  chest_cm numeric(5,2),
  hips_cm numeric(5,2),
  arms_cm numeric(5,2),
  thighs_cm numeric(5,2),
  estimation_method text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  photo_url text not null,
  thumbnail_url text,
  angle public.photo_angle not null,
  taken_at timestamptz not null default now(),
  weight_kg numeric(5,2),
  notes text,
  is_private boolean default true,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.photo_comparisons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  before_photo_id uuid not null references public.progress_photos(id),
  after_photo_id uuid not null references public.progress_photos(id),
  title text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.physique_projections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_photo_id uuid references public.progress_photos(id),
  projected_image_url text,
  target_date date,
  target_body_fat_pct numeric(4,2),
  ai_model_version text,
  disclaimer_acknowledged boolean default false,
  created_at timestamptz not null default now()
);

create table public.transformation_projections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  before_photo_id uuid references public.progress_photos(id) on delete set null,
  current_photo_id uuid references public.progress_photos(id) on delete set null,
  target_body_fat_pct numeric(4,2) not null,
  current_weight_kg numeric(5,2),
  current_body_fat_pct numeric(4,2),
  current_lean_mass_kg numeric(5,2),
  current_fat_mass_kg numeric(5,2),
  projected_weight_kg numeric(5,2),
  projected_body_fat_pct numeric(4,2),
  projected_lean_mass_kg numeric(5,2),
  projected_fat_mass_kg numeric(5,2),
  projected_weeks_to_target numeric(5,1),
  success_score numeric(5,2),
  workout_adherence_pct numeric(5,2),
  nutrition_adherence_pct numeric(5,2),
  weight_trend text,
  rationale text,
  confidence text default 'medium',
  engine_version text not null default 'transformation-v1',
  created_at timestamptz not null default now()
);

-- =============================================================================
-- GOALS & ANALYTICS
-- =============================================================================

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  goal_type public.goal_type not null,
  title text not null,
  description text,
  target_value numeric(12,2),
  current_value numeric(12,2),
  unit text,
  status public.goal_status not null default 'active',
  target_date date,
  completed_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.goal_milestones (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  title text not null,
  target_value numeric(12,2),
  achieved_at timestamptz,
  sort_order integer default 0
);

create table public.analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  snapshot_date date not null,
  period_type text not null check (period_type in ('daily', 'weekly', 'monthly', 'yearly')),
  metrics jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique(user_id, snapshot_date, period_type)
);

create table public.performance_trends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id uuid references public.exercises(id),
  trend_type text not null,
  period_start date not null,
  period_end date not null,
  data_points jsonb not null default '[]',
  estimated_1rm numeric(8,2),
  volume_change_pct numeric(6,2),
  consistency_streak integer,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- INTEGRATIONS: HEALTHKIT, WATCH, MOTION
-- =============================================================================

create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider public.integration_provider not null,
  is_connected boolean default false,
  access_token_encrypted text,
  refresh_token_encrypted text,
  scopes text[] default '{}',
  last_sync_at timestamptz,
  sync_status public.sync_status default 'pending',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique(user_id, provider)
);

create table public.healthkit_sync_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  data_type text not null,
  external_id text,
  value jsonb not null,
  recorded_at timestamptz not null,
  synced_at timestamptz not null default now()
);

create table public.watch_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  workout_session_id uuid references public.workout_sessions(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  heart_rate_samples jsonb default '[]',
  motion_summary jsonb default '{}',
  metadata jsonb not null default '{}'
);

create table public.motion_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid,
  recorded_at timestamptz not null default now(),
  accelerometer jsonb,
  gyroscope jsonb,
  movement_category public.movement_category,
  metadata jsonb not null default '{}'
);

create table public.rep_count_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  workout_set_id uuid references public.workout_sets(id),
  detected_reps integer not null,
  confidence numeric(4,3),
  confirmed_reps integer,
  is_confirmed boolean default false,
  detected_at timestamptz not null default now()
);

create table public.exercise_recognition_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid references public.workout_sessions(id),
  suggested_exercise_id uuid references public.exercises(id),
  suggested_name text not null,
  confidence numeric(4,3),
  movement_category public.movement_category,
  is_confirmed boolean default false,
  detected_at timestamptz not null default now()
);

-- =============================================================================
-- SUBSCRIPTIONS & ADS
-- =============================================================================

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade unique,
  tier public.subscription_tier not null default 'free',
  status public.subscription_status not null default 'active',
  stripe_customer_id text,
  stripe_subscription_id text,
  apple_transaction_id text,
  google_purchase_token text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancelled_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.ad_impressions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  placement public.ad_placement not null,
  ad_unit_id text,
  impression_at timestamptz not null default now(),
  was_clicked boolean default false
);

-- =============================================================================
-- NOTIFICATIONS
-- =============================================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text not null,
  payload jsonb default '{}',
  is_read boolean default false,
  sent_at timestamptz not null default now(),
  read_at timestamptz
);

-- =============================================================================
-- EXPORT, SHARING & PRINT
-- =============================================================================

create table public.exported_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content_type public.export_content_type not null,
  format public.export_format not null,
  title text not null,
  file_url text,
  file_size_bytes integer,
  source_entity_type text,
  source_entity_id uuid,
  is_printer_friendly boolean default true,
  privacy_level text default 'private' check (privacy_level in ('private', 'shared', 'public')),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_id uuid references public.exported_documents(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  password_hash text,
  max_views integer,
  view_count integer default 0,
  expires_at timestamptz,
  is_active boolean default true,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- INDEXES (performance-critical paths)
-- =============================================================================

create index idx_workout_sessions_user_started on public.workout_sessions(user_id, started_at desc);
create index idx_workout_sets_exercise_logged on public.workout_sets(workout_exercise_id, logged_at desc);
create index idx_user_metrics_user_recorded on public.user_metrics(user_id, recorded_at desc);
create index idx_goals_user_status on public.goals(user_id, status);
create index idx_ai_recommendations_user_type on public.ai_recommendations(user_id, recommendation_type, created_at desc);
create index idx_analytics_snapshots_user_date on public.analytics_snapshots(user_id, snapshot_date desc);
create index idx_heart_rate_user_recorded on public.heart_rate_samples(user_id, recorded_at desc);
create index idx_voice_logs_user_session on public.voice_log_entries(user_id, session_id);
create index idx_notifications_user_unread on public.notifications(user_id, is_read) where is_read = false;
create index idx_planned_workouts_user_date on public.planned_workouts(user_id, scheduled_date);
create index idx_progress_photos_user_taken on public.progress_photos(user_id, taken_at desc);
create index idx_transformation_projections_user_created on public.transformation_projections(user_id, created_at desc);

-- =============================================================================
-- UPDATED_AT TRIGGER
-- =============================================================================

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.handle_updated_at();
create trigger user_preferences_updated_at before update on public.user_preferences
  for each row execute function public.handle_updated_at();
create trigger workout_sessions_updated_at before update on public.workout_sessions
  for each row execute function public.handle_updated_at();
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.handle_updated_at();
create trigger goals_updated_at before update on public.goals
  for each row execute function public.handle_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Helper: all user-owned tables get standard RLS
do $$
declare
  tbl text;
  tables text[] := array[
    'profiles', 'workout_locations', 'user_preferences', 'user_metrics', 'user_devices', 'legal_acceptances',
    'user_custom_exercises', 'workout_sessions', 'workout_blocks', 'workout_exercises',
    'workout_sets', 'rest_periods', 'workout_density_metrics', 'training_programs',
    'training_phases', 'workout_templates', 'planned_workouts', 'recovery_assessments',
    'cardio_sessions', 'heart_rate_samples', 'voice_log_entries', 'ai_coaching_sessions',
    'ai_recommendations', 'ai_insights', 'nutrition_goals', 'meal_plans', 'meals',
    'grocery_lists', 'grocery_list_items', 'hydration_logs', 'nutrition_recommendations',
    'body_composition_records', 'progress_photos', 'photo_comparisons', 'physique_projections',
    'transformation_projections',
    'goals', 'goal_milestones', 'analytics_snapshots', 'performance_trends',
    'integration_connections', 'healthkit_sync_records', 'watch_sessions', 'motion_samples',
    'rep_count_events', 'exercise_recognition_events', 'subscriptions', 'subscription_events',
    'ad_impressions', 'notifications', 'exported_documents', 'share_links'
  ];
begin
  foreach tbl in array tables loop
    execute format('alter table public.%I enable row level security', tbl);
  end loop;
end $$;

-- Profiles: user owns their row
create policy "Users manage own profile" on public.profiles for all using (auth.uid() = id);
create policy "Users manage own workout locations" on public.workout_locations for all using (auth.uid() = user_id);

-- Generic user_id policies (covers most tables)
create policy "Users manage own preferences" on public.user_preferences for all using (auth.uid() = user_id);
create policy "Users manage own metrics" on public.user_metrics for all using (auth.uid() = user_id);
create policy "Users manage own devices" on public.user_devices for all using (auth.uid() = user_id);
create policy "Users manage own legal" on public.legal_acceptances for all using (auth.uid() = user_id);
create policy "Users manage own custom exercises" on public.user_custom_exercises for all using (auth.uid() = user_id);
create policy "Users manage own sessions" on public.workout_sessions for all using (auth.uid() = user_id);
create policy "Users manage own goals" on public.goals for all using (auth.uid() = user_id);
create policy "Users manage own subscriptions" on public.subscriptions for all using (auth.uid() = user_id);
create policy "Users manage own notifications" on public.notifications for all using (auth.uid() = user_id);
create policy "Users manage own exports" on public.exported_documents for all using (auth.uid() = user_id);
create policy "Users manage own share links" on public.share_links for all using (auth.uid() = user_id);
create policy "Users manage own integrations" on public.integration_connections for all using (auth.uid() = user_id);
create policy "Users manage own voice logs" on public.voice_log_entries for all using (auth.uid() = user_id);
create policy "Users manage own ai coaching" on public.ai_coaching_sessions for all using (auth.uid() = user_id);
create policy "Users manage own ai recommendations" on public.ai_recommendations for all using (auth.uid() = user_id);
create policy "Users manage own ai insights" on public.ai_insights for all using (auth.uid() = user_id);
create policy "Users manage own nutrition goals" on public.nutrition_goals for all using (auth.uid() = user_id);
create policy "Users manage own meal plans" on public.meal_plans for all using (auth.uid() = user_id);
create policy "Users manage own meals" on public.meals for all using (auth.uid() = user_id);
create policy "Users manage own grocery lists" on public.grocery_lists for all using (auth.uid() = user_id);
create policy "Users manage own hydration" on public.hydration_logs for all using (auth.uid() = user_id);
create policy "Users manage own body comp" on public.body_composition_records for all using (auth.uid() = user_id);
create policy "Users manage own photos" on public.progress_photos for all using (auth.uid() = user_id);
create policy "Users manage own transformation projections" on public.transformation_projections for all using (auth.uid() = user_id);
create policy "Users manage own cardio" on public.cardio_sessions for all using (auth.uid() = user_id);
create policy "Users manage own heart rate" on public.heart_rate_samples for all using (auth.uid() = user_id);
create policy "Users manage own analytics" on public.analytics_snapshots for all using (auth.uid() = user_id);
create policy "Users manage own training programs" on public.training_programs for all using (auth.uid() = user_id);
create policy "Users manage own training phases" on public.training_phases for all using (auth.uid() = user_id);
create policy "Users manage own templates" on public.workout_templates for all using (auth.uid() = user_id);
create policy "Users manage own planned workouts" on public.planned_workouts for all using (auth.uid() = user_id);
create policy "Users manage own recovery" on public.recovery_assessments for all using (auth.uid() = user_id);

-- Nested workout policies
create policy "Users manage own blocks" on public.workout_blocks for all using (
  session_id in (select id from public.workout_sessions where user_id = auth.uid())
);
create policy "Users manage own workout exercises" on public.workout_exercises for all using (
  session_id in (select id from public.workout_sessions where user_id = auth.uid())
);
create policy "Users manage own sets" on public.workout_sets for all using (
  workout_exercise_id in (
    select we.id from public.workout_exercises we
    join public.workout_sessions ws on ws.id = we.session_id
    where ws.user_id = auth.uid()
  )
);
create policy "Users manage own rest periods" on public.rest_periods for all using (
  session_id in (select id from public.workout_sessions where user_id = auth.uid())
);
create policy "Users manage own density metrics" on public.workout_density_metrics for all using (
  session_id in (select id from public.workout_sessions where user_id = auth.uid())
);

-- Grocery items via list ownership
create policy "Users manage own grocery items" on public.grocery_list_items for all using (
  grocery_list_id in (select id from public.grocery_lists where user_id = auth.uid())
);

-- Goal milestones via goal ownership
create policy "Users manage own milestones" on public.goal_milestones for all using (
  goal_id in (select id from public.goals where user_id = auth.uid())
);

-- Public read for system exercises
alter table public.exercises enable row level security;
create policy "Anyone can read exercises" on public.exercises for select using (true);
create policy "Users can insert custom exercises" on public.exercises for insert with check (auth.uid() = created_by);

-- =============================================================================
-- PROFILE AUTO-CREATE ON SIGNUP
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  insert into public.user_preferences (user_id) values (new.id);
  insert into public.subscriptions (user_id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- Sprint 8.5 — Beta User Readiness Pack
-- =============================================================================

create type public.feedback_type as enum ('bug', 'feature', 'support');
create type public.feedback_status as enum ('open', 'triaged', 'resolved', 'closed');

create table if not exists public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  feedback_type public.feedback_type not null,
  subject text not null,
  body text not null,
  screenshot_url text,
  device_metadata jsonb not null default '{}',
  app_version text,
  app_environment text,
  status public.feedback_status not null default 'open',
  founder_notified boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  session_id text,
  event_name text not null,
  properties jsonb not null default '{}',
  app_version text,
  app_environment text,
  platform text,
  created_at timestamptz not null default now()
);

create table if not exists public.beta_invites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text,
  max_uses int not null default 1,
  uses_count int not null default 0,
  is_internal boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.beta_invite_redemptions (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.beta_invites(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  unique (invite_id, user_id)
);

create table if not exists public.release_notes (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  title text not null,
  body text not null,
  is_published boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.changelog_entries (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  category text not null default 'improvement',
  summary text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists is_internal_tester boolean not null default false,
  add column if not exists beta_tester_tag text,
  add column if not exists beta_invite_code text;

create index if not exists idx_beta_feedback_created on public.beta_feedback(created_at desc);
create index if not exists idx_beta_feedback_status on public.beta_feedback(status, created_at desc);
create index if not exists idx_app_events_name_created on public.app_events(event_name, created_at desc);
create index if not exists idx_app_events_user_created on public.app_events(user_id, created_at desc);
create index if not exists idx_beta_invites_code on public.beta_invites(code);

alter table public.beta_feedback enable row level security;
alter table public.app_events enable row level security;
alter table public.beta_invites enable row level security;
alter table public.beta_invite_redemptions enable row level security;
alter table public.release_notes enable row level security;
alter table public.changelog_entries enable row level security;

create policy "Users insert own feedback" on public.beta_feedback for insert with check (auth.uid() = user_id);
create policy "Users read own feedback" on public.beta_feedback for select using (auth.uid() = user_id);
create policy "Users insert own events" on public.app_events for insert with check (auth.uid() = user_id);
create policy "Users read own events" on public.app_events for select using (auth.uid() = user_id);
create policy "Anyone read published release notes" on public.release_notes for select using (is_published = true);
create policy "Anyone read changelog" on public.changelog_entries for select using (true);
