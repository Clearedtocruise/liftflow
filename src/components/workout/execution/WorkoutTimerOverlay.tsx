import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import {
  circuitPhaseLabel,
  formatTimerSeconds,
  intervalPhaseLabel,
  TRADITIONAL_REST_PRESETS,
  type CircuitTimerState,
  type IntervalTimerState,
} from '@/lib/timerEngine';

type WorkoutTimerOverlayProps = {
  visible: boolean;
  traditional?: {
    secondsRemaining: number | null;
    recommendedSeconds: number;
    isPaused: boolean;
    onPause: () => void;
    onResume: () => void;
    onSkip: () => void;
    onAdjust: (deltaSeconds: number) => void;
    onSetRest: (seconds: number) => void;
    nextExerciseName?: string | null;
    nextExerciseDetail?: string | null;
  };
  interval?: IntervalTimerState | null;
  onIntervalToggle?: () => void;
  onIntervalSkip?: () => void;
  onIntervalSkipRound?: () => void;
  onIntervalReset?: () => void;
  onIntervalConfigChange?: (patch: Partial<IntervalTimerState['config']>) => void;
  circuit?: CircuitTimerState | null;
  onCircuitSkip?: () => void;
  onCircuitDismiss?: () => void;
};

function ConfigStepper({
  label,
  value,
  onDecrease,
  onIncrease,
}: {
  label: string;
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <View style={styles.configCell}>
      <AppText variant="caption" color="textSecondary">
        {label}
      </AppText>
      <View style={styles.configRow}>
        <Pressable style={styles.controlButton} onPress={onDecrease}>
          <AppText variant="bodyBold">−</AppText>
        </Pressable>
        <AppText variant="bodyBold">{value}</AppText>
        <Pressable style={styles.controlButton} onPress={onIncrease}>
          <AppText variant="bodyBold">+</AppText>
        </Pressable>
      </View>
    </View>
  );
}

export function WorkoutTimerOverlay({
  visible,
  traditional,
  interval,
  onIntervalToggle,
  onIntervalSkip,
  onIntervalSkipRound,
  onIntervalReset,
  onIntervalConfigChange,
  circuit,
  onCircuitSkip,
  onCircuitDismiss,
}: WorkoutTimerOverlayProps) {
  if (!visible) return null;

  const activeMode = circuit ? 'circuit' : interval ? 'interval' : traditional ? 'traditional' : null;
  if (!activeMode) return null;

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {activeMode === 'traditional' && traditional ? (
            <>
              <AppText variant="label" color="restTimer" align="center">
                Rest Timer
              </AppText>
              <AppText variant="timer" color="restTimer" align="center" style={styles.timer}>
                {formatTimerSeconds(traditional.secondsRemaining ?? traditional.recommendedSeconds)}
              </AppText>
              <AppText variant="footnote" color="textSecondary" align="center">
                {traditional.isPaused ? 'Paused' : 'Traditional · adjust rest before your next set'}
              </AppText>
              <View style={styles.controls}>
                <Pressable style={styles.controlButton} onPress={() => traditional.onAdjust(-30)}>
                  <AppText variant="bodyBold">−30s</AppText>
                </Pressable>
                <Pressable
                  style={styles.controlButton}
                  onPress={traditional.isPaused ? traditional.onResume : traditional.onPause}>
                  <AppText variant="bodyBold">{traditional.isPaused ? 'Resume' : 'Pause'}</AppText>
                </Pressable>
                <Pressable style={styles.controlButton} onPress={() => traditional.onAdjust(30)}>
                  <AppText variant="bodyBold">+30s</AppText>
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
                {TRADITIONAL_REST_PRESETS.map((seconds) => (
                  <Pressable key={seconds} style={styles.presetButton} onPress={() => traditional.onSetRest(seconds)}>
                    <AppText variant="caption">{seconds}s</AppText>
                  </Pressable>
                ))}
              </ScrollView>
              {traditional.nextExerciseName ? (
                <View style={styles.nextPreview}>
                  <AppText variant="label" color="textSecondary" align="center">
                    Next up
                  </AppText>
                  <AppText variant="bodyBold" align="center">
                    {traditional.nextExerciseName}
                  </AppText>
                  {traditional.nextExerciseDetail ? (
                    <AppText variant="caption" color="textTertiary" align="center">
                      {traditional.nextExerciseDetail}
                    </AppText>
                  ) : null}
                </View>
              ) : null}
              <PrimaryButton label="Continue" onPress={traditional.onSkip} variant="secondary" />
            </>
          ) : null}

          {activeMode === 'interval' && interval && onIntervalToggle && onIntervalSkip && onIntervalSkipRound && onIntervalReset && onIntervalConfigChange ? (
            <>
              <AppText variant="label" color="accent" align="center">
                {interval.config.rounds > 0 ? `${intervalPhaseLabel(interval.phase)} · Round ${interval.round}/${interval.config.rounds}` : intervalPhaseLabel(interval.phase)}
              </AppText>
              <AppText variant="timer" color="restTimer" align="center" style={styles.timer}>
                {formatTimerSeconds(interval.secondsRemaining)}
              </AppText>
              <View style={styles.configGrid}>
                <ConfigStepper
                  label="Work (sec)"
                  value={interval.config.workSeconds}
                  onDecrease={() =>
                    onIntervalConfigChange({ workSeconds: Math.max(5, interval.config.workSeconds - 5) })
                  }
                  onIncrease={() => onIntervalConfigChange({ workSeconds: interval.config.workSeconds + 5 })}
                />
                <ConfigStepper
                  label="Rest (sec)"
                  value={interval.config.restSeconds}
                  onDecrease={() =>
                    onIntervalConfigChange({ restSeconds: Math.max(5, interval.config.restSeconds - 5) })
                  }
                  onIncrease={() => onIntervalConfigChange({ restSeconds: interval.config.restSeconds + 5 })}
                />
                <ConfigStepper
                  label="Rounds"
                  value={interval.config.rounds}
                  onDecrease={() => onIntervalConfigChange({ rounds: Math.max(1, interval.config.rounds - 1) })}
                  onIncrease={() => onIntervalConfigChange({ rounds: interval.config.rounds + 1 })}
                />
              </View>
              <View style={styles.controls}>
                <PrimaryButton
                  label={interval.running ? 'Pause' : interval.phase === 'done' ? 'Restart' : 'Start'}
                  onPress={onIntervalToggle}
                />
                <Pressable style={styles.controlButtonWide} onPress={onIntervalSkip}>
                  <AppText variant="bodyBold">Skip phase</AppText>
                </Pressable>
                <Pressable style={styles.controlButtonWide} onPress={onIntervalSkipRound}>
                  <AppText variant="bodyBold">Skip round</AppText>
                </Pressable>
              </View>
              <PrimaryButton label="Reset" onPress={onIntervalReset} variant="secondary" />
            </>
          ) : null}

          {activeMode === 'circuit' && circuit && onCircuitSkip && onCircuitDismiss ? (
            <>
              <AppText variant="label" color="accent" align="center">
                Circuit · {circuitPhaseLabel(circuit.phase)}
              </AppText>
              <AppText variant="timer" color="restTimer" align="center" style={styles.timer}>
                {formatTimerSeconds(circuit.secondsRemaining)}
              </AppText>
              <AppText variant="footnote" color="textSecondary" align="center">
                Round {circuit.round} · move to the next station
              </AppText>
              <View style={styles.controls}>
                <PrimaryButton label="Skip" onPress={onCircuitSkip} variant="secondary" />
                <PrimaryButton label="Continue" onPress={onCircuitDismiss} />
              </View>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: LiftFlowColors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: LiftFlowColors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: LiftFlowColors.restTimerMuted,
    padding: Spacing.xxl,
    gap: Spacing.lg,
  },
  timer: {
    fontSize: 56,
    lineHeight: 64,
  },
  controls: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  controlButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.backgroundSecondary,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  controlButtonWide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.backgroundSecondary,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  presetRow: {
    gap: Spacing.sm,
  },
  presetButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: LiftFlowColors.surfaceElevated,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    marginRight: Spacing.sm,
  },
  nextPreview: {
    gap: Spacing.xs,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LiftFlowColors.border,
  },
  configGrid: {
    gap: Spacing.sm,
  },
  configCell: {
    gap: Spacing.xs,
  },
  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
});
