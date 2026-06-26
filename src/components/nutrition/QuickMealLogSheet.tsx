import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { mealTypeLabel } from '@/lib/mealSchedule';
import type { MealType } from '@/types/common';

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

type QuickMealLogSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    mealType: MealType;
    calories?: number;
    proteinG?: number;
  }) => Promise<void>;
};

export function QuickMealLogSheet({ visible, onClose, onSubmit }: QuickMealLogSheetProps) {
  const [name, setName] = useState('');
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName('');
    setMealType('lunch');
    setCalories('');
    setProtein('');
  }, [visible]);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        mealType,
        calories: calories.trim() ? Number.parseInt(calories, 10) : undefined,
        proteinG: protein.trim() ? Number.parseInt(protein, 10) : undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
              bounces={false}
              showsVerticalScrollIndicator={false}>
              <AppText variant="title">Log a meal</AppText>
          <AppText variant="footnote" color="textSecondary">
            Log what you ate — no meal plan required.
          </AppText>

          <View style={styles.field}>
            <AppText variant="caption" color="textSecondary">
              What did you eat?
            </AppText>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Chicken rice bowl"
              placeholderTextColor={LiftFlowColors.textTertiary}
              autoFocus
            />
          </View>

          <View style={styles.field}>
            <AppText variant="caption" color="textSecondary">
              Meal
            </AppText>
            <View style={styles.chips}>
              {MEAL_TYPES.map((type) => (
                <Pressable
                  key={type}
                  onPress={() => setMealType(type)}
                  style={[styles.chip, mealType === type && styles.chipActive]}>
                  <AppText variant="caption" color={mealType === type ? 'accent' : 'textSecondary'}>
                    {mealTypeLabel(type)}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.macros}>
            <View style={styles.macroField}>
              <AppText variant="caption" color="textSecondary">
                Calories
              </AppText>
              <TextInput
                style={styles.input}
                value={calories}
                onChangeText={setCalories}
                keyboardType="number-pad"
                placeholder="Optional"
                placeholderTextColor={LiftFlowColors.textTertiary}
              />
            </View>
            <View style={styles.macroField}>
              <AppText variant="caption" color="textSecondary">
                Protein (g)
              </AppText>
              <TextInput
                style={styles.input}
                value={protein}
                onChangeText={setProtein}
                keyboardType="number-pad"
                placeholder="Optional"
                placeholderTextColor={LiftFlowColors.textTertiary}
              />
            </View>
          </View>

          <View style={styles.actions}>
            <PrimaryButton label="Save meal" onPress={handleSave} loading={saving} disabled={!name.trim()} />
            <PrimaryButton label="Cancel" variant="secondary" onPress={onClose} />
          </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    padding: Spacing.xl,
  },
  sheet: {
    backgroundColor: LiftFlowColors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    gap: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.border,
  },
  field: {
    gap: Spacing.xs,
  },
  input: {
    backgroundColor: LiftFlowColors.backgroundSecondary,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: LiftFlowColors.textPrimary,
    fontSize: 16,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  chipActive: {
    borderColor: LiftFlowColors.accent,
    backgroundColor: 'rgba(31, 107, 255, 0.12)',
  },
  macros: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  macroField: {
    flex: 1,
    gap: Spacing.xs,
  },
  actions: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
});
