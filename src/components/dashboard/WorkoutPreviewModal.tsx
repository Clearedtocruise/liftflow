import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { buildWorkoutPreview, summarizeWorkoutPreview } from '@/lib/workoutPreview';
import type { EditableWorkoutExercise } from '@/types/workoutExecution';

type WorkoutPreviewModalProps = {
  visible: boolean;
  workoutName: string;
  exercises: EditableWorkoutExercise[];
  onClose: () => void;
  onStart?: () => void;
  startDisabled?: boolean;
};

/**
 * The full exercise list for a planned workout.
 *
 * The home card only had room for the first four exercises, so the only way to see the rest of the
 * session was to start it. Tapping the workout heading opens this instead.
 */
export function WorkoutPreviewModal({
  visible,
  workoutName,
  exercises,
  onClose,
  onStart,
  startDisabled,
}: WorkoutPreviewModalProps) {
  const preview = buildWorkoutPreview(exercises);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <AppText variant="title" numberOfLines={2}>
              {workoutName}
            </AppText>
            <AppText variant="footnote" color="textSecondary">
              {summarizeWorkoutPreview(preview)}
            </AppText>
          </View>

          {preview.rows.length === 0 ? (
            <AppText variant="body" color="textSecondary">
              This workout does not have any exercises yet.
            </AppText>
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {preview.rows.map((row) => (
                <View key={row.id} style={styles.row}>
                  <AppText variant="footnote" color="textTertiary" style={styles.position}>
                    {row.position}
                  </AppText>
                  <View style={styles.rowText}>
                    <AppText variant="body">
                      {row.supersetLabel ? `${row.supersetLabel}. ` : ''}
                      {row.name}
                    </AppText>
                    <AppText variant="caption" color="textSecondary">
                      {row.detail}
                    </AppText>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={styles.actions}>
            {onStart ? (
              <PrimaryButton label="Start Workout" onPress={onStart} disabled={startDisabled} />
            ) : null}
            <PrimaryButton label="Close" variant="ghost" onPress={onClose} />
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
  header: {
    gap: Spacing.half,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    gap: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LiftFlowColors.border,
  },
  position: {
    width: 20,
    textAlign: 'right',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  actions: {
    gap: Spacing.sm,
  },
});
