import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { HealthMetricSample } from '@/integrations/types';
import { mapHealthKitWorkoutToCardio } from '@/lib/mapHealthKitWorkoutToCardio';

describe('mapHealthKitWorkoutToCardio', () => {
  it('maps Outdoor Run (HK type 37) with active calories and distance', () => {
    const sample: HealthMetricSample = {
      dataType: 'workout_session',
      externalId: 'hk-uuid-run-1',
      recordedAt: '2026-07-17T14:22:00.000Z',
      value: {
        activityType: 37,
        durationSeconds: 1718,
        calories: 900,
        distanceMeters: 5327,
      },
    };

    const mapped = mapHealthKitWorkoutToCardio(sample);
    assert.ok(mapped);
    assert.equal(mapped!.cardioType, 'run');
    assert.equal(mapped!.caloriesBurned, 900);
    assert.equal(mapped!.distanceMeters, 5327);
    assert.equal(mapped!.notes, 'Outdoor Run');
    assert.equal(mapped!.metadata.source, 'apple_healthkit');
    assert.equal(mapped!.metadata.external_id, 'hk-uuid-run-1');
    assert.equal(mapped!.metadata.calorieKind, 'active');
  });

  it('skips traditional strength workouts', () => {
    const sample: HealthMetricSample = {
      dataType: 'workout_session',
      externalId: 'hk-uuid-lift',
      recordedAt: '2026-07-17T15:00:00.000Z',
      value: {
        activityType: 50,
        durationSeconds: 3600,
        calories: 400,
      },
    };
    assert.equal(mapHealthKitWorkoutToCardio(sample), null);
  });
});
