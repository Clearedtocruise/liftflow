import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CardioActivityPicker } from '@/components/cardio/CardioActivityPicker';
import { CardioSessionPanel } from '@/components/cardio/CardioSessionPanel';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { CARDIO_ACTIVITIES, cardioActivityById, type CardioActivity } from '@/constants/cardioActivities';
import { Spacing } from '@/constants/theme';

export default function CardioTrackingScreen() {
  const { activity: activityParam } = useLocalSearchParams<{ activity?: string }>();
  const initialActivity = useMemo(
    () => cardioActivityById(typeof activityParam === 'string' ? activityParam : '') ?? CARDIO_ACTIVITIES[0],
    [activityParam],
  );
  const [selected, setSelected] = useState<CardioActivity>(initialActivity);

  useEffect(() => {
    setSelected(initialActivity);
  }, [initialActivity]);

  return (
    <ScreenContainer contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()}>
        <AppText variant="footnote" color="accent">
          ← Back
        </AppText>
      </Pressable>

      <AppText variant="headline">Cardio & HIIT</AppText>
      <AppText variant="body" color="textSecondary">
        Choose a conditioning session for cardio days, recovery work, or Tabata intervals.
      </AppText>

      <CardioActivityPicker selectedId={selected.id} onSelect={setSelected} />

      <View style={styles.sessionBlock}>
        <AppText variant="label" color="textSecondary">
          Active Session
        </AppText>
        <CardioSessionPanel activity={selected} />
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
