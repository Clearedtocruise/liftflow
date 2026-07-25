import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CardioActivityPicker } from '@/components/cardio/CardioActivityPicker';
import { CardioSessionPanel } from '@/components/cardio/CardioSessionPanel';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { CARDIO_ACTIVITIES, type CardioActivity } from '@/constants/cardioActivities';
import { Spacing } from '@/constants/theme';

export default function CardioTrackingScreen() {
  const params = useLocalSearchParams<{ activity?: string; title?: string }>();
  const [selected, setSelected] = useState<CardioActivity>(
    () => CARDIO_ACTIVITIES.find((activity) => activity.id === params.activity) ?? CARDIO_ACTIVITIES[0],
  );

  return (
    <ScreenContainer contentContainerStyle={styles.content}>
      {/* Named after the planned session when opened from a conditioning day, so the header
          matches the card the user just tapped. */}
      <Stack.Screen options={{ title: params.title ?? 'Cardio & HIIT' }} />

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
