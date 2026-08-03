import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import type { ManageDayAction, ManageDayPickerOption } from '@/lib/planDayActions';
import type { WeeklyPlanEntry } from '@/lib/weekPlan';
import type { ScheduleChange } from '@/types/planAdaptation';

export type { ManageDayAction };

type PickerKind = 'swap' | 'move' | 'rest' | 'do-today';

type ManageDayModalProps = {
  visible: boolean;
  title?: string;
  showWeekList?: boolean;
  weeklyPlan: WeeklyPlanEntry[];
  focusDate: string;
  todayLabel: string;
  focusWorkoutId: string | null;
  actions: ManageDayAction[];
  swapTargets: ManageDayPickerOption[];
  moveTargets: ManageDayPickerOption[];
  restDayTargets: ManageDayPickerOption[];
  doTodayTargets: ManageDayPickerOption[];
  onScheduleChange: (change: ScheduleChange) => void;
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

const PICKER_TITLES: Record<PickerKind, string> = {
  swap: 'Swap with',
  move: 'Move to',
  rest: 'Swap with rest day',
  'do-today': 'Move to today',
};

export function ManageDayModal({
  visible,
  title = 'Manage Day',
  showWeekList = true,
  weeklyPlan,
  focusDate,
  todayLabel,
  focusWorkoutId,
  actions,
  swapTargets,
  moveTargets,
  restDayTargets,
  doTodayTargets,
  onScheduleChange,
  onClose,
}: ManageDayModalProps) {
  const [picker, setPicker] = useState<PickerKind | null>(null);

  useEffect(() => {
    if (!visible) setPicker(null);
  }, [visible]);

  function closeAll() {
    setPicker(null);
    onClose();
  }

  function runInstantAction(action: ManageDayAction) {
    closeAll();
    action.onPress();
  }

  function openPicker(kind: PickerKind) {
    setPicker(kind);
  }

  function pickerOptions(): ManageDayPickerOption[] {
    switch (picker) {
      case 'swap':
        return swapTargets;
      case 'move':
        return moveTargets;
      case 'rest':
        return restDayTargets;
      case 'do-today':
        return doTodayTargets;
      default:
        return [];
    }
  }

  function handlePickerSelect(option: ManageDayPickerOption) {
    if (!focusWorkoutId && picker !== 'do-today') {
      closeAll();
      return;
    }

    switch (picker) {
      case 'swap':
        onScheduleChange({ type: 'swap', workoutIdA: focusWorkoutId!, workoutIdB: option.id });
        break;
      case 'move':
        onScheduleChange({ type: 'move', workoutId: focusWorkoutId!, toDate: option.id });
        break;
      case 'rest':
        onScheduleChange({ type: 'move', workoutId: focusWorkoutId!, toDate: option.id });
        break;
      case 'do-today':
        onScheduleChange({ type: 'move', workoutId: option.id, toDate: focusDate });
        break;
      default:
        break;
    }
    closeAll();
  }

  const options = pickerOptions();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={closeAll}>
      <Pressable style={styles.backdrop} onPress={closeAll}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()} testID="manage-day-modal">
          {picker ? (
            <>
              <AppText variant="title">{PICKER_TITLES[picker]}</AppText>
              <AppText variant="footnote" color="textSecondary">
                {todayLabel}
              </AppText>
              {options.length === 0 ? (
                <AppText variant="body" color="textSecondary">
                  No options available this week.
                </AppText>
              ) : (
                <ScrollView style={styles.pickerList} bounces={false}>
                  {options.map((option) => (
                    <Pressable
                      key={option.id}
                      style={styles.pickerRow}
                      onPress={() => handlePickerSelect(option)}
                      testID={picker === 'swap' ? 'swap-target-option' : undefined}>
                      <AppText variant="body">{option.label}</AppText>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
              <PrimaryButton label="Back" variant="ghost" onPress={() => setPicker(null)} />
            </>
          ) : (
            <>
              <AppText variant="title">{title}</AppText>
              <AppText variant="footnote" color="textSecondary">
                {todayLabel}
              </AppText>

              {showWeekList ? (
                <View style={styles.weekList}>
                  {weeklyPlan.map((entry) => {
                    const isFocusDay = entry.date === focusDate;
                    return (
                      <View key={entry.date} style={[styles.weekRow, isFocusDay && styles.weekRowToday]}>
                        <AppText variant="caption" color={isFocusDay ? 'accent' : 'textTertiary'} style={styles.dayCol}>
                          {DAY_ABBR[entry.day] ?? entry.day.slice(0, 3)}
                        </AppText>
                        <AppText variant="body" color={isFocusDay ? 'textPrimary' : 'textSecondary'} style={styles.titleCol}>
                          {entry.isRestDay ? 'Rest' : entry.title}
                        </AppText>
                      </View>
                    );
                  })}
                </View>
              ) : null}

              <View style={styles.actions}>
                {actions.map((action) => (
                  <PrimaryButton
                    key={action.id}
                    label={action.label}
                    variant={
                      action.destructive
                        ? 'secondary'
                        : action.id === 'move-tomorrow' || action.id === 'start-workout'
                          ? 'primary'
                          : 'secondary'
                    }
                    onPress={() => {
                      if (action.picker) {
                        openPicker(action.picker);
                        return;
                      }
                      runInstantAction(action);
                    }}
                    testID={
                      action.id === 'swap-workout'
                        ? 'swap-day-button'
                        : action.id === 'move-day' || action.id === 'move-tomorrow'
                          ? 'move-day-button'
                          : undefined
                    }
                  />
                ))}
                <PrimaryButton label="Cancel" variant="ghost" onPress={closeAll} />
              </View>
            </>
          )}
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
  pickerList: {
    maxHeight: 280,
  },
  pickerRow: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LiftFlowColors.border,
  },
});
