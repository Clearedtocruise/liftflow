import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing, TouchTarget } from '@/constants/theme';
import type { MovementPhase } from '@/lib/exerciseGuideSections';

const SPEED_OPTIONS = [
  { label: '0.5x', multiplier: 0.5 },
  { label: '1x', multiplier: 1 },
  { label: '1.5x', multiplier: 1.5 },
  { label: '2x', multiplier: 2 },
] as const;

const BASE_PHASE_MS = 3600;

type ExerciseMovementPhasesProps = {
  phases: MovementPhase[];
  /** Resets the walkthrough when the sheet is reopened on a different exercise. */
  resetKey?: string;
};

/**
 * Walks the lifter through one phase of the movement at a time, with autoplay so the cues can be
 * followed without holding the phone.
 */
export function ExerciseMovementPhases({ phases, resetKey }: ExerciseMovementPhasesProps) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setIndex(0);
    setPlaying(false);
  }, [resetKey, phases.length]);

  useEffect(() => {
    if (!playing || phases.length < 2) return;

    timerRef.current = setInterval(() => {
      setIndex((current) => (current + 1) % phases.length);
    }, BASE_PHASE_MS / speed);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [playing, speed, phases.length]);

  if (phases.length === 0) return null;

  const phase = phases[Math.min(index, phases.length - 1)]!;
  const step = (direction: 1 | -1) => {
    setPlaying(false);
    setIndex((current) => (current + direction + phases.length) % phases.length);
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <AppText variant="label" color="accent">
          MOVEMENT WALKTHROUGH
        </AppText>
        <AppText variant="caption" color="textTertiary">
          {index + 1} of {phases.length}
        </AppText>
      </View>

      <View style={styles.phaseRow}>
        {phases.map((item, phaseIndex) => (
          <Pressable
            key={`${item.label}-${phaseIndex}`}
            accessibilityRole="button"
            accessibilityLabel={`Phase ${phaseIndex + 1}: ${item.label}`}
            accessibilityState={{ selected: phaseIndex === index }}
            onPress={() => {
              setPlaying(false);
              setIndex(phaseIndex);
            }}
            style={[styles.phaseChip, phaseIndex === index && styles.phaseChipActive]}>
            <AppText
              variant="caption"
              color={phaseIndex === index ? 'accent' : 'textTertiary'}
              numberOfLines={1}>
              {item.label.toUpperCase()}
            </AppText>
          </Pressable>
        ))}
      </View>

      <View style={styles.detail}>
        <AppText variant="bodyBold">{phase.label.toUpperCase()}</AppText>
        <AppText variant="body" color="textSecondary">
          {phase.detail}
        </AppText>
      </View>

      <View style={styles.controls}>
        <ControlButton label="‹" accessibilityLabel="Previous phase" onPress={() => step(-1)} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Pause walkthrough' : 'Play walkthrough'}
          onPress={() => setPlaying((current) => !current)}
          style={[styles.playButton, playing && styles.playButtonActive]}>
          <AppText variant="bodyBold" color={playing ? 'accent' : 'textPrimary'}>
            {playing ? 'Pause' : 'Play'}
          </AppText>
        </Pressable>
        <ControlButton label="›" accessibilityLabel="Next phase" onPress={() => step(1)} />
      </View>

      <View style={styles.speedRow}>
        <AppText variant="caption" color="textTertiary">
          SPEED
        </AppText>
        {SPEED_OPTIONS.map((option) => (
          <Pressable
            key={option.label}
            accessibilityRole="button"
            accessibilityLabel={`Walkthrough speed ${option.label}`}
            accessibilityState={{ selected: speed === option.multiplier }}
            onPress={() => setSpeed(option.multiplier)}
            style={[styles.speedChip, speed === option.multiplier && styles.speedChipActive]}>
            <AppText
              variant="caption"
              color={speed === option.multiplier ? 'accent' : 'textSecondary'}>
              {option.label}
            </AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ControlButton({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={8}
      style={styles.controlButton}>
      <AppText variant="headline" color="textSecondary">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: LiftFlowColors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  phaseRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  phaseChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  phaseChipActive: {
    borderColor: LiftFlowColors.accent,
    backgroundColor: LiftFlowColors.accentGlow,
  },
  detail: {
    gap: Spacing.xs,
    minHeight: 76,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  controlButton: {
    minWidth: TouchTarget.min,
    minHeight: TouchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
    backgroundColor: LiftFlowColors.surfaceElevated,
  },
  playButton: {
    paddingHorizontal: Spacing.xl,
    minHeight: TouchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    backgroundColor: LiftFlowColors.surfaceElevated,
  },
  playButtonActive: {
    borderColor: LiftFlowColors.accent,
    backgroundColor: LiftFlowColors.accentGlow,
  },
  speedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  speedChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  speedChipActive: {
    borderColor: LiftFlowColors.accent,
    backgroundColor: LiftFlowColors.accentGlow,
  },
});
