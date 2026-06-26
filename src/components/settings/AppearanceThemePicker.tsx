import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { themeOptions, type AppTheme } from '@/constants/themes';
import type { ThemeId } from '@/constants/themes';
import { useThemedStyles } from '@/hooks/useLiftFlowTheme';

type AppearanceThemePickerProps = {
  value: ThemeId;
  onChange?: (id: ThemeId) => void;
};

export function AppearanceThemePicker({ value, onChange }: AppearanceThemePickerProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <Card style={styles.card}>
      <AppText variant="bodyBold">Theme</AppText>
      {themeOptions.map((option) => {
        const selected = value === option.id;
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange?.(option.id)}
            style={[styles.row, selected && styles.rowSelected]}
            accessibilityRole="button"
            accessibilityState={{ selected }}>
            <View style={styles.textBlock}>
              <AppText variant="callout">{option.label}</AppText>
              <AppText variant="caption" color="textSecondary">
                {option.description}
              </AppText>
            </View>
            <View style={[styles.radio, selected && styles.radioSelected]}>
              {selected ? <View style={styles.radioDot} /> : null}
            </View>
          </Pressable>
        );
      })}
    </Card>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      gap: theme.spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    rowSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryGlow,
    },
    textBlock: {
      flex: 1,
      gap: theme.spacing.xs,
    },
    radio: {
      width: 22,
      height: 22,
      borderRadius: theme.radius.full,
      borderWidth: 2,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioSelected: {
      borderColor: theme.colors.primary,
    },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.primary,
    },
  });
}
