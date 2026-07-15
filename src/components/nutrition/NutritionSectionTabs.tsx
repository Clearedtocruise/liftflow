import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import type { AppTheme } from '@/constants/themes';
import { useThemedStyles } from '@/hooks/useLiftFlowTheme';

export type NutritionSection = 'today' | 'week' | 'shopping';

type NutritionSectionTabsProps = {
  active: NutritionSection;
  onChange: (section: NutritionSection) => void;
};

const SECTIONS: { id: NutritionSection; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Week' },
  { id: 'shopping', label: 'Shop' },
];

export function NutritionSectionTabs({ active, onChange }: NutritionSectionTabsProps) {
  const styles = useThemedStyles(createStyles);

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

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    tabActive: {
      borderColor: theme.colors.accent,
      backgroundColor: theme.colors.accentGlow,
    },
  });
}
