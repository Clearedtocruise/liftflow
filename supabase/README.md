# LiftFlow Supabase Setup

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a project.
2. Copy **Project URL** and **anon public key** from Settings → API.

## 2. Configure environment

Copy `.env.example` to `.env` in the project root:

```bash
cp .env.example .env
```

Fill in:

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
EXPO_PUBLIC_API_URL=http://YOUR_LOCAL_IP:3000
```

For the backend (`backend/.env` or root `.env` loaded by backend):

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPENAI_API_KEY=sk-...   # optional but enables AI coaching, voice enhancement, physique projection
PORT=3000
```

## 3. Apply database schema

In the Supabase SQL Editor, run in order:

1. `supabase/schema.sql` — full schema, RLS, triggers
2. `supabase/migrations/002_seed_and_storage.sql` — exercise seed data, storage bucket, default nutrition goals

Alternatively with Supabase CLI:

```bash
supabase db push
```

## 4. Start services

**Backend** (from `backend/`):

```bash
npm run dev
```

**Mobile app** (from project root):

```bash
node ./node_modules/expo/bin/cli start
```

For iPhone on Expo Go, use tunnel mode:

```bash
CI=0 node ./node_modules/expo/bin/cli start --tunnel
```

## 5. Verify auth

1. Sign up with email/password in the app.
2. Confirm profile row exists in `profiles` table.
3. Force-quit Expo Go and reopen — session should persist.

## Storage

Progress photos upload to the `progress-photos` bucket. PDF exports also use this bucket when service role is configured.
