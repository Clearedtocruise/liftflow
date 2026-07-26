import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, MetricAccents, Radius, Spacing, type MetricAccent } from '@/constants/theme';

export type QuickAction = {
  label: string;
  icon: string;
  accent: MetricAccent;
  onPress: () => void;
};

export function QuickActionGrid({ actions }: { actions: QuickAction[] }) {
  return (
    <View style={styles.grid}>
      {actions.map((action) => {
        const { tint, glow } = MetricAccents[action.accent];
        return (
          <Pressable
            key={action.label}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={action.onPress}
            style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
            <View style={[styles.iconWrap, { backgroundColor: glow, borderColor: tint }]}>
              <AppText variant="headline" style={{ color: tint }}>
                {action.icon}
              </AppText>
            </View>
            <AppText variant="caption" color="textSecondary" align="center" numberOfLines={2}>
              {action.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  tile: {
    flex: 1,
    gap: Spacing.sm,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    backgroundColor: LiftFlowColors.surface,
  },
  pressed: {
    opacity: 0.85,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
