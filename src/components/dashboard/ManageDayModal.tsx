import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import type { WeeklyPlanEntry } from '@/lib/weekPlan';

export type ManageDayAction = {
  id: string;
  label: string;
  destructive?: boolean;
  onPress: () => void;
};

type ManageDayModalProps = {
  visible: boolean;
  weeklyPlan: WeeklyPlanEntry[];
  todayDate: string;
  todayLabel: string;
  actions: ManageDayAction[];
  onClose: () => void;
};

const DAY_ABBR: Record<string, string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
};

export function ManageDayModal({
  visible,
  weeklyPlan,
  todayDate,
  todayLabel,
  actions,
  onClose,
}: ManageDayModalProps) {
  function runAction(action: ManageDayAction) {
    onClose();
    action.onPress();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <AppText variant="title">Manage Day</AppText>
          <AppText variant="footnote" color="textSecondary">
            {todayLabel}
          </AppText>

          <View style={styles.weekList}>
            {weeklyPlan.map((entry) => {
              const isToday = entry.date === todayDate;
              return (
                <View key={entry.date} style={[styles.weekRow, isToday && styles.weekRowToday]}>
                  <AppText variant="caption" color={isToday ? 'accent' : 'textTertiary'} style={styles.dayCol}>
                    {DAY_ABBR[entry.day] ?? entry.day.slice(0, 3)}
                  </AppText>
                  <AppText variant="body" color={isToday ? 'textPrimary' : 'textSecondary'} style={styles.titleCol}>
                    {entry.isRestDay ? 'Rest' : entry.title}
                  </AppText>
                </View>
              );
            })}
          </View>

          <View style={styles.actions}>
            {actions.map((action) => (
              <PrimaryButton
                key={action.id}
                label={action.label}
                variant={action.destructive ? 'secondary' : action.id === 'move-tomorrow' ? 'primary' : 'secondary'}
                onPress={() => runAction(action)}
              />
            ))}
            <PrimaryButton label="Cancel" variant="ghost" onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  sheet: {
    backgroundColor: LiftFlowColors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    gap: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.border,
    maxHeight: '85%',
  },
  weekList: {
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
  },
  weekRowToday: {
    backgroundColor: 'rgba(31, 107, 255, 0.12)',
  },
  dayCol: {
    width: 36,
  },
  titleCol: {
    flex: 1,
  },
  actions: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
});
