import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { MuscleMapFigure } from '@/components/exercise/anatomy/MuscleMapFigure';
import { AppText } from '@/components/ui/AppText';
import { muscleLabel } from '@/constants/muscles';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import {
    buildBodyHighlightData,
    resolveBodySide,
    resolveExerciseMuscles,
    type ExerciseMuscleProfile,
} from '@/lib/exerciseMuscleMap';

type ExerciseMusclePanelProps = {
  exerciseName: string;
  muscleGroups?: string[];
  gender?: 'male' | 'female';
  variant?: 'hero' | 'compact' | 'inline';
  profile?: ExerciseMuscleProfile;
};

export function ExerciseMusclePanel({
  exerciseName,
  muscleGroups,
  gender = 'male',
  variant = 'hero',
  profile: profileOverride,
}: ExerciseMusclePanelProps) {
  const profile = useMemo(
    () => profileOverride ?? resolveExerciseMuscles(exerciseName, muscleGroups),
    [exerciseName, muscleGroups, profileOverride],
  );
  const bodyData = useMemo(
    () => buildBodyHighlightData(profile.primary, profile.secondary),
    [profile.primary, profile.secondary],
  );
  const preferredSide = useMemo(() => resolveBodySide(profile), [profile]);
  const [side, setSide] = useState<'front' | 'back'>(preferredSide);

  useEffect(() => {
    setSide(preferredSide);
  }, [preferredSide, exerciseName]);

  if (bodyData.length === 0) return null;

  const compact = variant === 'compact' || variant === 'inline';
  const scale = variant === 'inline' ? 0.75 : compact ? 0.85 : 1.05;
  const height = variant === 'inline' ? 120 : compact ? 150 : 210;

  return (
    <View style={[styles.panel, compact && styles.panelCompact, variant === 'inline' && styles.panelInline]}>
      {variant === 'hero' ? (
        <View style={styles.toggleRow}>
          <SideChip label="Front" active={side === 'front'} onPress={() => setSide('front')} />
          <SideChip label="Back" active={side === 'back'} onPress={() => setSide('back')} />
        </View>
      ) : null}

      <View style={variant === 'inline' ? styles.inlineRow : undefined}>
        <MuscleMapFigure data={bodyData} side={side} gender={gender} scale={scale} height={height} />
        {variant === 'inline' ? (
          <View style={styles.inlineLegend}>
            <LegendList profile={profile} compact />
          </View>
        ) : null}
      </View>

      {variant !== 'inline' ? <LegendList profile={profile} compact={compact} /> : null}
    </View>
  );
}

function SideChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <AppText variant="caption" color={active ? 'accent' : 'textSecondary'}>
        {label}
      </AppText>
    </Pressable>
  );
}

function LegendList({ profile, compact }: { profile: ExerciseMuscleProfile; compact?: boolean }) {
  if (profile.primary.length === 0 && profile.secondary.length === 0) return null;

  return (
    <View style={[styles.legend, compact && styles.legendCompact]}>
      {profile.primary.map((muscle) => (
        <LegendDot key={`p-${muscle}`} color="#FF3B30" label={muscleLabel(muscle)} />
      ))}
      {profile.secondary.map((muscle) => (
        <LegendDot key={`s-${muscle}`} color="#2E7DF6" label={muscleLabel(muscle)} />
      ))}
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <AppText variant="caption" color="textSecondary">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: Spacing.sm,
    alignItems: 'center',
  },
  panelCompact: {
    gap: Spacing.xs,
  },
  panelInline: {
    width: '100%',
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  inlineLegend: {
    flex: 1,
    justifyContent: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  chipActive: {
    borderColor: LiftFlowColors.accent,
    backgroundColor: 'rgba(31, 107, 255, 0.12)',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  legendCompact: {
    gap: Spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
  },
});
