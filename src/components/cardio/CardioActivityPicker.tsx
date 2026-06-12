import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { CARDIO_ACTIVITIES, type CardioActivity } from '@/constants/cardioActivities';
import { LiftFlowColors, Spacing } from '@/constants/theme';

type CardioActivityPickerProps = {
  selectedId?: string;
  onSelect: (activity: CardioActivity) => void;
};

export function CardioActivityPicker({ selectedId, onSelect }: CardioActivityPickerProps) {
  return (
    <View style={styles.container}>
      {CARDIO_ACTIVITIES.map((activity) => {
        const selected = activity.id === selectedId;
        return (
          <Pressable key={activity.id} onPress={() => onSelect(activity)}>
            <Card style={[styles.card, selected && styles.cardSelected]}>
              <AppText variant="bodyBold">{activity.label}</AppText>
              <AppText variant="footnote" color="textSecondary">
                {activity.description}
              </AppText>
            </Card>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  card: {
    gap: Spacing.xs,
  },
  cardSelected: {
    borderColor: LiftFlowColors.accent,
  },
});
