import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable } from 'react-native';

import { CardioActivityPicker } from '@/components/cardio/CardioActivityPicker';
import { CardioSessionPanel } from '@/components/cardio/CardioSessionPanel';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { TabScreenHeader } from '@/components/layout/TabScreenHeader';
import { AppText } from '@/components/ui/AppText';
import { CARDIO_ACTIVITIES, cardioActivityById, type CardioActivity } from '@/constants/cardioActivities';

export default function CardioTrackingScreen() {
  const { activity: activityParam } = useLocalSearchParams<{ activity?: string }>();
  const focusedActivity = useMemo(
    () => (activityParam ? cardioActivityById(activityParam) : undefined),
    [activityParam],
  );
  const [selected, setSelected] = useState<CardioActivity>(focusedActivity ?? CARDIO_ACTIVITIES[0]);
  const active = focusedActivity ?? selected;
  const isFocused = Boolean(focusedActivity);

  return (
    <ScreenContainer
      header={
        <TabScreenHeader
          showBrand={false}
          title={isFocused ? active.label : 'Cardio & HIIT'}
          subtitle={
            isFocused
              ? active.mode === 'steady' &&
                (active.type === 'walk' || active.type === 'run' || active.type === 'cycle')
                ? 'Live distance, pace, and calories while you move'
                : 'Timer-based session with calorie estimates'
              : 'Conditioning for cardio days, recovery, or Tabata'
          }
          right={
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <AppText variant="caption" color="accent">
                Back
              </AppText>
            </Pressable>
          }
        />
      }>
      {!isFocused ? <CardioActivityPicker selectedId={selected.id} onSelect={setSelected} /> : null}

      {!isFocused ? <SectionHeader title="Active session" variant="secondary" /> : null}

      <CardioSessionPanel
        activity={active}
        activityKind={active.type === 'walk' ? 'walk' : undefined}
      />
    </ScreenContainer>
  );
}
