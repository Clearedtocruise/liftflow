import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { ChipGrid, SelectableChip } from '@/components/onboarding/SelectableChip';
import { AppText } from '@/components/ui/AppText';
import {
    EQUIPMENT_CATEGORIES,
    EQUIPMENT_PRESET_LIST,
    equipmentByCategory,
    type EquipmentPresetId,
} from '@/constants/equipmentCatalog';
import { LiftFlowColors, Radius, Shadows, Spacing } from '@/constants/theme';

const PRESET_EMOJI: Record<string, string> = {
  home_minimal: '🏠',
  home_gym: '🏠',
  garage_gym: '🏠',
  planet_fitness: '🏋️',
  commercial_gym: '🏋️',
  powerlifting_gym: '🏋️',
  full_gym: '🏆',
};

const CATEGORY_EMOJI: Record<string, string> = {
  free_weights: '🏋️',
  racks_benches: '🪑',
  cable_machines: '⚙️',
  bodyweight_accessories: '🤸',
};

type EquipmentPickerProps = {
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function EquipmentPicker({ selected, onChange, disabled }: EquipmentPickerProps) {
  const hasFullGym = selected.includes('full_gym');

  function toggle(id: string) {
    if (disabled) return;
    if (id === 'full_gym') {
      onChange(selected.includes('full_gym') ? [] : ['full_gym']);
      return;
    }
    const withoutFull = selected.filter((item) => item !== 'full_gym');
    onChange(
      withoutFull.includes(id) ? withoutFull.filter((item) => item !== id) : [...withoutFull, id],
    );
  }

  function applyPreset(presetId: EquipmentPresetId) {
    if (disabled) return;
    const preset = EQUIPMENT_PRESET_LIST.find((p) => p.id === presetId);
    if (preset) onChange([...preset.equipment]);
  }

  return (
    <View style={styles.root}>
      <AppText variant="label" color="textSecondary">
        Quick Gym Presets
      </AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
        {EQUIPMENT_PRESET_LIST.map((preset) => (
          <PresetCard
            key={preset.id}
            emoji={PRESET_EMOJI[preset.id] ?? '🏋️'}
            label={preset.label}
            description={preset.description}
            onPress={() => applyPreset(preset.id)}
            disabled={disabled}
          />
        ))}
      </ScrollView>

      {hasFullGym ? (
        <View style={styles.fullGymBanner}>
          <AppText variant="bodyBold">🏆 Full gym selected</AppText>
          <AppText variant="footnote" color="textSecondary">
            All exercises available in your programming.
          </AppText>
          <Pressable onPress={() => onChange([])} disabled={disabled}>
            <AppText variant="footnote" color="accent">
              Customize equipment →
            </AppText>
          </Pressable>
        </View>
      ) : (
        EQUIPMENT_CATEGORIES.map((category) => {
          const items = equipmentByCategory(category.id);
          if (items.length === 0) return null;
          return (
            <View key={category.id} style={styles.section}>
              <View style={styles.sectionHeader}>
                <AppText variant="label" color="accent">
                  {CATEGORY_EMOJI[category.id] ?? '•'} {category.label.toUpperCase()}
                </AppText>
              </View>
              <ChipGrid>
                {items.map((item) => (
                  <SelectableChip
                    key={item.id}
                    label={item.label}
                    selected={selected.includes(item.id)}
                    onPress={() => toggle(item.id)}
                  />
                ))}
              </ChipGrid>
            </View>
          );
        })
      )}

      <View style={styles.footer}>
        <AppText variant="footnote" color="textTertiary">
          {selected.length === 0
            ? 'Select equipment or apply a preset above.'
            : `${selected.length} item${selected.length === 1 ? '' : 's'} selected`}
        </AppText>
      </View>
    </View>
  );
}

function PresetCard({
  emoji,
  label,
  description,
  onPress,
  disabled,
}: {
  emoji: string;
  label: string;
  description: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.96, { damping: 15 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15 });
      }}
      style={[styles.presetCard, anim, disabled && styles.disabled]}>
      <AppText variant="title" style={styles.presetEmoji}>
        {emoji}
      </AppText>
      <AppText variant="footnote" style={styles.presetLabel}>
        {label}
      </AppText>
      <AppText variant="caption" color="textTertiary" numberOfLines={2}>
        {description}
      </AppText>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.lg,
  },
  presetRow: {
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  presetCard: {
    width: 140,
    minHeight: 120,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    backgroundColor: LiftFlowColors.surface,
    gap: Spacing.xs,
    ...Shadows.card,
  },
  presetEmoji: {
    fontSize: 28,
    lineHeight: 32,
  },
  presetLabel: {
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
  section: {
    gap: Spacing.md,
  },
  sectionHeader: {
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: LiftFlowColors.border,
  },
  fullGymBanner: {
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: LiftFlowColors.primaryGlow,
    borderWidth: 1,
    borderColor: LiftFlowColors.primary,
  },
  footer: {
    paddingTop: Spacing.sm,
  },
});
