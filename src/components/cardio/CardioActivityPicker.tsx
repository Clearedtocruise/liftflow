import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ChipGrid, SelectableChip } from '@/components/onboarding/SelectableChip';
import { AppText } from '@/components/ui/AppText';
import {
  CARDIO_ACTIVITIES,
  CARDIO_ACTIVITY_CATEGORIES,
  type CardioActivity,
  type CardioActivityCategory,
} from '@/constants/cardioActivities';
import { LiftFlowColors, Spacing } from '@/constants/theme';

type CardioActivityPickerProps = {
  selectedId: string | null;
  onSelect: (activity: CardioActivity) => void;
  disabled?: boolean;
};

export function CardioActivityPicker({ selectedId, onSelect, disabled }: CardioActivityPickerProps) {
  const [category, setCategory] = useState<CardioActivityCategory>('running');

  const filtered = useMemo(
    () => CARDIO_ACTIVITIES.filter((activity) => activity.category === category),
    [category],
  );

  return (
    <View style={styles.root}>
      <AppText variant="label" color="accent">
        Cardio & Sports
      </AppText>
      <AppText variant="footnote" color="textSecondary">
        Pick an activity — tap Start when ready.
      </AppText>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
        {CARDIO_ACTIVITY_CATEGORIES.map((item) => (
          <SelectableChip
            key={item.id}
            label={item.label}
            selected={category === item.id}
            onPress={() => setCategory(item.id)}
          />
        ))}
      </ScrollView>

      <ChipGrid>
        {filtered.map((activity) => (
          <SelectableChip
            key={activity.id}
            label={activity.label}
            icon={activity.icon}
            selected={selectedId === activity.id}
            onPress={() => !disabled && onSelect(activity)}
          />
        ))}
      </ChipGrid>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.sm,
  },
  categoryRow: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  categoryChip: {
    borderColor: LiftFlowColors.border,
  },
});
