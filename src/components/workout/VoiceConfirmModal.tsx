import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { intentLabel } from '@/lib/voice';
import type { ParsedVoiceCommand } from '@/types';

type VoiceConfirmModalProps = {
  visible: boolean;
  parsed: ParsedVoiceCommand | null;
  transcript: string;
  onConfirm: () => void;
  onReject: () => void;
};

export function VoiceConfirmModal({
  visible,
  parsed,
  transcript,
  onConfirm,
  onReject,
}: VoiceConfirmModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <AppText variant="title">Confirm Set</AppText>
          <AppText variant="body" color="textSecondary" style={styles.transcript}>
            "{transcript}"
          </AppText>

          {parsed ? (
            <View style={styles.parsed}>
              <AppText variant="caption" color="textSecondary">
                {intentLabel(parsed.intent)}
              </AppText>
              <AppText variant="bodyBold">{parsed.exercise ?? '—'}</AppText>
              {parsed.intent === 'log_set' || !parsed.intent ? (
                <AppText variant="metric" color="accent">
                  {parsed.weight ?? '—'} × {parsed.reps ?? '—'}
                </AppText>
              ) : parsed.targetWeight != null ? (
                <AppText variant="metric" color="accent">
                  Target {parsed.targetWeight} {parsed.weightUnit ?? 'lb'}
                </AppText>
              ) : null}
            </View>
          ) : null}

          <View style={styles.actions}>
            <PrimaryButton label="Save Set" onPress={onConfirm} />
            <Pressable onPress={onReject} style={styles.cancel}>
              <AppText variant="body" color="textSecondary">
                Cancel
              </AppText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: LiftFlowColors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xxl,
    gap: Spacing.lg,
  },
  transcript: {
    fontStyle: 'italic',
  },
  parsed: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  actions: {
    gap: Spacing.md,
  },
  cancel: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
});
