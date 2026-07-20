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
  onOpenAppleFitness?: () => void;
};

export function WorkoutRestDayScreen({ day, onBack, onOpenAppleFitness }: WorkoutRestDayScreenProps) {
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
          Recovery starts here. Track walks and cardio in Apple Fitness — ONE MORE pulls them in for daily totals.
        </AppText>
      </Card>

      {onOpenAppleFitness ? (
        <View style={styles.actions}>
          <PrimaryButton
            label="Connect Apple Health"
            variant="secondary"
            onPress={onOpenAppleFitness}
          />
        </View>
      ) : null}
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
