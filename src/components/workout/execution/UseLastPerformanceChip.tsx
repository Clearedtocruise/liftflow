import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { TouchTarget } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useLiftFlowTheme';

type UseLastPerformanceChipProps = {
  /** Formatted performance e.g. "185 lb × 8" */
  performanceLine: string;
  origin: 'session' | 'history';
  alreadyApplied: boolean;
  onPress: () => void;
  disabled?: boolean;
};

export function UseLastPerformanceChip({
  performanceLine,
  origin,
  alreadyApplied,
  onPress,
  disabled,
}: UseLastPerformanceChipProps) {
  const styles = useThemedStyles(createStyles);
  const prefix = origin === 'session' ? 'Use last' : 'Last time';

  if (alreadyApplied) {
    return (
      <View style={styles.applied} accessibilityLabel={`${prefix} applied: ${performanceLine}`}>
        <AppText variant="footnote" color="accent">
          Using {origin === 'session' ? 'last set' : 'last time'} · {performanceLine}
        </AppText>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${prefix} ${performanceLine}`}
      style={({ pressed }) => [
        styles.chip,
        pressed && styles.chipPressed,
        disabled && styles.chipDisabled,
      ]}
      testID="use-last-performance-chip">
      <AppText variant="bodyBold" color="accent">
        {prefix} · {performanceLine}
      </AppText>
      <AppText variant="caption" color="textTertiary">
        Tap to fill
      </AppText>
    </Pressable>
  );
}

function createStyles(theme: import('@/constants/themes').AppTheme) {
  return StyleSheet.create({
    chip: {
      minHeight: TouchTarget.min,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.accent,
      backgroundColor: theme.colors.primaryGlow,
      gap: 2,
    },
    chipPressed: {
      backgroundColor: theme.colors.surfaceHighlight,
    },
    chipDisabled: {
      opacity: 0.5,
    },
    applied: {
      paddingVertical: theme.spacing.xs,
    },
  });
}
