import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CardioActivityPicker } from '@/components/cardio/CardioActivityPicker';
import { CardioSessionPanel } from '@/components/cardio/CardioSessionPanel';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { CARDIO_ACTIVITIES, cardioActivityById, type CardioActivity } from '@/constants/cardioActivities';
import { Spacing } from '@/constants/theme';

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
    <ScreenContainer contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()}>
        <AppText variant="footnote" color="accent">
          ← Back
        </AppText>
      </Pressable>

      <AppText variant="headline">{isFocused ? active.label : 'Cardio & HIIT'}</AppText>
      <AppText variant="body" color="textSecondary">
        {isFocused
          ? 'Start the timer when you begin. Calories are estimated from your profile weight and pace.'
          : 'Choose a conditioning session for cardio days, recovery work, or Tabata intervals.'}
      </AppText>

      {!isFocused ? (
        <CardioActivityPicker selectedId={selected.id} onSelect={setSelected} />
      ) : null}

      <View style={styles.sessionBlock}>
        {!isFocused ? (
          <AppText variant="label" color="textSecondary">
            Active Session
          </AppText>
        ) : null}
        <CardioSessionPanel
          activity={active}
          activityKind={active.type === 'walk' ? 'walk' : undefined}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.lg,
    paddingBottom: Spacing.huge,
  },
  sessionBlock: {
    gap: Spacing.sm,
  },
});
