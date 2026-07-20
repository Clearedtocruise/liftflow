import { router, useLocalSearchParams } from 'expo-router';

import { WorkoutRestDayScreen } from '@/components/workout/execution/WorkoutRestDayScreen';
import { WEEKDAY_LABELS } from '@/lib/weekPlan';

export default function WorkoutRestDayRoute() {
  const { date, label } = useLocalSearchParams<{ date: string; label: string }>();
  const dayLabel = WEEKDAY_LABELS.includes(label as (typeof WEEKDAY_LABELS)[number])
    ? (label as (typeof WEEKDAY_LABELS)[number])
    : 'Sunday';

  return (
    <WorkoutRestDayScreen
      day={{ date: date ?? new Date().toISOString().slice(0, 10), dayLabel }}
      onBack={() => router.back()}
      onOpenAppleFitness={() => router.push('/(features)/healthkit')}
    />
  );
}
