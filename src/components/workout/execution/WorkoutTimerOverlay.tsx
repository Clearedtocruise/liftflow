import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { WorkoutUpNextCard } from '@/components/workout/execution/WorkoutUpNextCard';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import {
    circuitPhaseLabel,
    formatTimerSeconds,
    intervalPhaseLabel,
    TRADITIONAL_REST_PRESETS,
    type CircuitTimerState,
    type IntervalTimerState,
} from '@/lib/timerEngine';
import type { WorkoutPositionLabels } from '@/lib/workoutUpNext';

type WorkoutTimerOverlayProps = {
  visible: boolean;
  position?: WorkoutPositionLabels | null;
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
  intervalSecondBounds?: { min: number; max: number; step: number };
  intervalExerciseName?: string | null;
  intervalNextExerciseName?: string | null;
  onIntervalDismiss?: () => void;
  betweenExerciseRestSeconds?: number;
  onBetweenExerciseRestChange?: (seconds: number) => void;
  betweenExerciseRestBounds?: { min: number; max: number; step: number };
  circuitTimerMode?: 'prep' | 'between_exercises';
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
  position,
  traditional,
  interval,
  onIntervalToggle,
  onIntervalSkip,
  onIntervalSkipRound,
  onIntervalReset,
  onIntervalConfigChange,
  intervalSecondBounds,
  intervalExerciseName,
  intervalNextExerciseName,
  onIntervalDismiss,
  betweenExerciseRestSeconds,
  onBetweenExerciseRestChange,
  betweenExerciseRestBounds,
  circuitTimerMode,
  circuit,
  onCircuitSkip,
  onCircuitDismiss,
}: WorkoutTimerOverlayProps) {
  const activeMode = circuit ? 'circuit' : interval ? 'interval' : traditional ? 'traditional' : null;
  const showModal = visible && activeMode != null;

  const intervalMin = intervalSecondBounds?.min ?? 5;
  const intervalMax = intervalSecondBounds?.max ?? 300;
  const intervalStep = intervalSecondBounds?.step ?? 5;

  const clampIntervalSeconds = (value: number) =>
    Math.min(intervalMax, Math.max(intervalMin, value));

  function handleRequestClose() {
    if (activeMode === 'traditional') traditional?.onSkip();
    else if (activeMode === 'interval') onIntervalDismiss?.();
    else onCircuitDismiss?.();
  }

  return (
    <Modal
      visible={showModal}
      transparent
      animationType="fade"
      onRequestClose={handleRequestClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card} testID="rest-timer">
          {position ? <WorkoutUpNextCard position={position} compact /> : null}

          {activeMode === 'traditional' && traditional ? (
            <>
              <AppText variant="label" color="restTimer" align="center">
                Rest Timer
              </AppText>
              <AppText variant="timer" color="restTimer" align="center" style={styles.timer}>
                {formatTimerSeconds(traditional.secondsRemaining ?? traditional.recommendedSeconds)}
              </AppText>
              <AppText variant="footnote" color="textSecondary" align="center">
                {traditional.isPaused
                  ? 'Paused'
                  : position?.upNextLabel
                    ? `Next: ${position.upNextLabel}`
                    : 'Traditional · adjust rest before your next set'}
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
              {traditional.nextExerciseName && !position ? (
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
              <PrimaryButton label="Continue" onPress={traditional.onSkip} variant="secondary" testID="rest-timer-skip" />
            </>
          ) : null}

          {activeMode === 'interval' && interval && onIntervalToggle && onIntervalSkip && onIntervalSkipRound && onIntervalReset && onIntervalConfigChange ? (
            <>
              {intervalExerciseName ? (
                <AppText variant="bodyBold" align="center">
                  {intervalExerciseName}
                </AppText>
              ) : null}
              <AppText
                variant="headline"
                color={interval.phase === 'work' ? 'accent' : interval.phase === 'rest' ? 'restTimer' : 'textSecondary'}
                align="center"
                style={styles.phaseHeadline}>
                {intervalPhaseLabel(interval.phase).toUpperCase()}
              </AppText>
              <AppText variant="caption" color="textSecondary" align="center">
                {position?.currentSetLabel ?? `Round ${interval.round} of ${interval.config.rounds}`}
              </AppText>
              <AppText variant="timer" color="restTimer" align="center" style={styles.timer}>
                {formatTimerSeconds(interval.secondsRemaining)}
              </AppText>
              <View style={styles.configGrid}>
                <ConfigStepper
                  label="Work (sec)"
                  value={interval.config.workSeconds}
                  onDecrease={() =>
                    onIntervalConfigChange({
                      workSeconds: clampIntervalSeconds(interval.config.workSeconds - intervalStep),
                    })
                  }
                  onIncrease={() =>
                    onIntervalConfigChange({
                      workSeconds: clampIntervalSeconds(interval.config.workSeconds + intervalStep),
                    })
                  }
                />
                <ConfigStepper
                  label="Rest (sec)"
                  value={interval.config.restSeconds}
                  onDecrease={() =>
                    onIntervalConfigChange({
                      restSeconds: clampIntervalSeconds(interval.config.restSeconds - intervalStep),
                    })
                  }
                  onIncrease={() =>
                    onIntervalConfigChange({
                      restSeconds: clampIntervalSeconds(interval.config.restSeconds + intervalStep),
                    })
                  }
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
              {onIntervalDismiss ? (
                <PrimaryButton label="Continue to workout" onPress={onIntervalDismiss} variant="ghost" />
              ) : null}
            </>
          ) : null}

          {activeMode === 'circuit' && circuit && onCircuitSkip && onCircuitDismiss ? (
            <>
              <AppText variant="label" color="accent" align="center">
                {circuitTimerMode === 'prep'
                  ? 'Get ready'
                  : betweenExerciseRestSeconds != null
                    ? 'Rest between exercises'
                    : `Circuit · ${circuitPhaseLabel(circuit.phase)}`}
              </AppText>
              {intervalNextExerciseName && !position ? (
                <>
                  <AppText variant="caption" color="textSecondary" align="center">
                    Next up
                  </AppText>
                  <AppText variant="bodyBold" align="center">
                    {intervalNextExerciseName}
                  </AppText>
                </>
              ) : null}
              <AppText variant="timer" color="restTimer" align="center" style={styles.timer}>
                {formatTimerSeconds(circuit.secondsRemaining)}
              </AppText>
              {betweenExerciseRestSeconds != null &&
              onBetweenExerciseRestChange &&
              betweenExerciseRestBounds &&
              circuitTimerMode !== 'prep' ? (
                <ConfigStepper
                  label="Between exercises (sec)"
                  value={betweenExerciseRestSeconds}
                  onDecrease={() =>
                    onBetweenExerciseRestChange(
                      Math.max(
                        betweenExerciseRestBounds.min,
                        betweenExerciseRestSeconds - betweenExerciseRestBounds.step,
                      ),
                    )
                  }
                  onIncrease={() =>
                    onBetweenExerciseRestChange(
                      Math.min(
                        betweenExerciseRestBounds.max,
                        betweenExerciseRestSeconds + betweenExerciseRestBounds.step,
                      ),
                    )
                  }
                />
              ) : (
                <AppText variant="footnote" color="textSecondary" align="center">
                  Round {circuit.round} · move to the next station
                </AppText>
              )}
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
  phaseHeadline: {
    letterSpacing: 2,
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
