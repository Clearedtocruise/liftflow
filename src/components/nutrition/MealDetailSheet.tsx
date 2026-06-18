import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { enrichMealMeta } from '@/lib/mealIngredients';
import { mealTypeLabel } from '@/lib/mealSchedule';
import type { Meal } from '@/types';

type MealDetailSheetProps = {
  visible: boolean;
  meal: Meal | null;
  scheduledTime?: string;
  onClose: () => void;
  onReplace?: () => void;
  onMarkComplete?: (status: 'completed' | 'modified' | 'skipped') => void;
};

export function MealDetailSheet({
  visible,
  meal,
  scheduledTime,
  onClose,
  onReplace,
  onMarkComplete,
}: MealDetailSheetProps) {
  if (!meal) return null;

  const meta = enrichMealMeta(meal.name, meal.instructions);
  const completed = meta.status === 'completed';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView contentContainerStyle={styles.container}>
        <AppText variant="title">Meal details</AppText>
        <AppText variant="footnote" color="textSecondary">
          {scheduledTime ?? 'Scheduled'} · {mealTypeLabel(meal.mealType)}
        </AppText>
        <AppText variant="bodyBold">{meal.name}</AppText>

        <View style={styles.ingredients}>
          {(meta.ingredients ?? []).map((ingredient) => (
            <AppText key={`${meal.id}-${ingredient.name}`} variant="footnote" color="textSecondary">
              {ingredient.name} · {ingredient.serving}
            </AppText>
          ))}
        </View>

        <AppText variant="body" color="textSecondary">
          {meal.calories ?? 0} cal · {Math.round(meal.proteinG ?? 0)}P · {Math.round(meal.carbsG ?? 0)}C ·{' '}
          {Math.round(meal.fatG ?? 0)}F
        </AppText>

        {!completed && onMarkComplete ? (
          <View style={styles.actions}>
            <PrimaryButton label="Ate as planned" onPress={() => onMarkComplete('completed')} />
            <View style={styles.secondaryRow}>
              <Pressable onPress={() => onMarkComplete('modified')}>
                <AppText variant="caption" color="textSecondary">
                  Modified
                </AppText>
              </Pressable>
              <Pressable onPress={() => onMarkComplete('skipped')}>
                <AppText variant="caption" color="textSecondary">
                  Skipped
                </AppText>
              </Pressable>
            </View>
          </View>
        ) : null}

        {!completed && onReplace ? (
          <PrimaryButton label="Replace meal" variant="secondary" onPress={onReplace} />
        ) : null}

        <PrimaryButton label="Close" variant="secondary" onPress={onClose} />
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: LiftFlowColors.background,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  ingredients: {
    gap: Spacing.xs,
  },
  actions: {
    gap: Spacing.sm,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
});
