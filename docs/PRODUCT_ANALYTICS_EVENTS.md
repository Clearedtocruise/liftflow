# Product Analytics Events — Sprint 8.5

Events are tracked client-side via `productAnalyticsService` and stored in Supabase `app_events`.

## Event catalog

| Event | Constant | When fired |
|-------|----------|------------|
| Onboarding completed | `onboarding_completed` | User finishes onboarding flow |
| Workout completed | `workout_completed` | Session marked complete |
| Voice logging | `voice_log_used` | Successful voice set log |
| AI Coach | `ai_coach_used` | Coach / converse interaction |
| Recovery | `recovery_viewed` | Recovery intelligence screen |
| Nutrition | `nutrition_viewed` | Nutrition intelligence screen |
| Transformation | `transformation_run` | Transformation projection run |
| Peak Music | `peak_music_used` | Peak music voice or auto-sync |
| Watch sync | `watch_sync_used` | Watch assistant sync |
| Subscription started | `subscription_started` | Trial or purchase started |
| Subscription converted | `subscription_converted` | Trial → paid |
| Feedback submitted | `feedback_submitted` | Bug / feature / support form |

## Properties

Each event may include a `properties` JSON object (strings, numbers, booleans). All events include:

- `userId`, `sessionId`, `appVersion`, `appEnvironment`, `platform`

## Founder metrics

`GET /api/beta/metrics` (founder key) aggregates DAU, WAU, conversion, retention, and 7-day event counts.

## Client usage

```typescript
import { productAnalyticsService, PRODUCT_EVENTS } from '@/services/productAnalyticsService';

await productAnalyticsService.track(userId, PRODUCT_EVENTS.WORKOUT_COMPLETED, { sessionId });
```
