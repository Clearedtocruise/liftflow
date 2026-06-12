import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';

export type NutritionSection = 'today' | 'week' | 'shopping';

type NutritionSectionTabsProps = {
  active: NutritionSection;
  onChange: (section: NutritionSection) => void;
};

const SECTIONS: { id: NutritionSection; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Week' },
  { id: 'shopping', label: 'Shopping List' },
];

export function NutritionSectionTabs({ active, onChange }: NutritionSectionTabsProps) {
  return (
    <View style={styles.row}>
      {SECTIONS.map((section) => {
        const selected = section.id === active;
        return (
          <Pressable
            key={section.id}
            style={[styles.tab, selected && styles.tabActive]}
            onPress={() => onChange(section.id)}>
            <AppText variant="bodyBold" color={selected ? 'textPrimary' : 'textSecondary'}>
              {section.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.surface,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  tabActive: {
    borderColor: LiftFlowColors.accent,
    backgroundColor: LiftFlowColors.accentGlow,
  },
});
