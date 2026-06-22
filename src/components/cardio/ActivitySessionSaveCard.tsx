import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { formatCalorieEstimate } from '@/lib/activityCalories';
import { formatCardioDuration } from '@/lib/exerciseModality';

type ActivitySessionSaveCardProps = {
  activityLabel: string;
  durationSeconds: number;
  distanceLabel?: string;
  estimatedCalories: number;
  usedDefaultWeight: boolean;
  saving?: boolean;
  onSave: () => void;
  onDiscard?: () => void;
};

export function ActivitySessionSaveCard({
  activityLabel,
  durationSeconds,
  distanceLabel,
  estimatedCalories,
  usedDefaultWeight,
  saving,
  onSave,
  onDiscard,
}: ActivitySessionSaveCardProps) {
  return (
    <View style={styles.card}>
      <AppText variant="bodyBold" align="center">
        {activityLabel} complete
      </AppText>
      <AppText variant="footnote" color="textSecondary" align="center">
        {formatCardioDuration(durationSeconds)}
        {distanceLabel ? ` · ${distanceLabel}` : ''}
      </AppText>
      <AppText variant="label" color="accent" align="center">
        {formatCalorieEstimate(estimatedCalories, usedDefaultWeight)}
      </AppText>
      <PrimaryButton label="Save activity" onPress={onSave} loading={saving} size="large" />
      {onDiscard ? (
        <PrimaryButton label="Discard" variant="ghost" onPress={onDiscard} disabled={saving} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: LiftFlowColors.surface,
    borderWidth: 1,
    borderColor: LiftFlowColors.accent,
  },
});
