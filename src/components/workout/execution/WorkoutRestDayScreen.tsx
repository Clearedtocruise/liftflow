import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { Spacing } from '@/constants/theme';
import { isToday, type WeekDayPlan } from '@/lib/weekPlan';

type WorkoutRestDayScreenProps = {
  day: Pick<WeekDayPlan, 'date' | 'dayLabel'>;
  onBack: () => void;
  onLogCardio: () => void;
};

export function WorkoutRestDayScreen({ day, onBack, onLogCardio }: WorkoutRestDayScreenProps) {
  const today = isToday(day.date);

  return (
    <ScreenContainer contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} hitSlop={8}>
        <AppText variant="footnote" color="accent">
          ← Weekly Plan
        </AppText>
      </Pressable>

      <Card style={styles.summary}>
        <AppText variant="label" color={today ? 'accent' : 'textSecondary'}>
          {day.dayLabel}
          {today ? ' · Today' : ''}
        </AppText>
        <AppText variant="title">Rest Day</AppText>
        <AppText variant="footnote" color="textSecondary">
          Recovery, mobility, or optional light activity
        </AppText>
      </Card>

      <View style={styles.actions}>
        <PrimaryButton label="Log Cardio" variant="secondary" onPress={onLogCardio} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.lg,
    paddingBottom: Spacing.huge,
  },
  summary: {
    gap: Spacing.sm,
  },
  actions: {
    gap: Spacing.sm,
  },
});
