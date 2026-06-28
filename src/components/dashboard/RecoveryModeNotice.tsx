import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import type { AppTheme } from '@/constants/themes';
import { useThemedStyles } from '@/hooks/useLiftFlowTheme';

type RecoveryModeNoticeProps = {
  recoveryScore?: number | null;
  recoveryModeActive?: boolean;
};

/** Explains automatic volume reductions — Fitbod/Ladder users hate silent plan changes. */
export function RecoveryModeNotice({ recoveryScore, recoveryModeActive }: RecoveryModeNoticeProps) {
  const styles = useThemedStyles(createStyles);

  if (!recoveryModeActive && (recoveryScore == null || recoveryScore >= 40)) return null;

  const scoreLabel = recoveryScore != null ? ` (score ${Math.round(recoveryScore)})` : '';

  return (
    <View style={styles.wrap}>
      <AppText variant="label" color="restTimer">
        Recovery mode active{scoreLabel}
      </AppText>
      <AppText variant="footnote" color="textSecondary">
        Today&apos;s workout uses reduced sets and lighter intensity so you can train without digging a deeper hole.
        Check in tomorrow — your plan will ramp back up when you&apos;re ready.
      </AppText>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    wrap: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      gap: theme.spacing.xs,
      marginBottom: theme.spacing.lg,
    },
  });
}
