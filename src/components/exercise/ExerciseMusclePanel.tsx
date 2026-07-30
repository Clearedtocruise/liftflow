import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { MuscleMapFigure } from '@/components/exercise/anatomy/MuscleMapFigure';
import { MuscleProfileLabels } from '@/components/exercise/anatomy/MuscleProfileLabels';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import {
    buildBodyHighlightData,
    filterProfileForSide,
    resolveBodySide,
    resolveExerciseMuscles,
    type ExerciseMuscleProfile,
} from '@/lib/exerciseMuscleMap';

type ExerciseMusclePanelProps = {
  exerciseName: string;
  muscleGroups?: string[];
  exerciseSlug?: string | null;
  gender?: 'male' | 'female';
  /** hero = whole workout overview, exercise = per-exercise card, compact = active session */
  variant?: 'hero' | 'compact' | 'inline';
  profile?: ExerciseMuscleProfile;
};

export function ExerciseMusclePanel({
  exerciseName,
  muscleGroups,
  exerciseSlug,
  gender = 'male',
  variant = 'hero',
  profile: profileOverride,
}: ExerciseMusclePanelProps) {
  const profile = useMemo(
    () => profileOverride ?? resolveExerciseMuscles(exerciseName, muscleGroups, exerciseSlug),
    [exerciseName, muscleGroups, exerciseSlug, profileOverride],
  );
  const preferredSide = useMemo(() => resolveBodySide(profile), [profile]);
  const [side, setSide] = useState<'front' | 'back'>(preferredSide);

  useEffect(() => {
    setSide(preferredSide);
  }, [preferredSide, exerciseName]);

  const sideProfile = useMemo(() => filterProfileForSide(profile, side), [profile, side]);
  const bodyData = useMemo(
    () => buildBodyHighlightData(profile.primary, profile.secondary, side),
    [profile.primary, profile.secondary, side],
  );

  if (profile.primary.length === 0 && profile.secondary.length === 0) return null;

  if (variant === 'inline' || variant === 'compact') {
    return (
      <ExerciseMuscleRow
        profile={profile}
        sideProfile={filterProfileForSide(profile, preferredSide)}
        bodyData={buildBodyHighlightData(profile.primary, profile.secondary, preferredSide)}
        side={preferredSide}
        gender={gender}
        size={variant === 'compact' ? 'active' : 'exercise'}
      />
    );
  }

  if (bodyData.length === 0) return null;

  return (
    <View style={styles.workoutPanel}>
      <View style={styles.toggleRow}>
        <SideChip label="Front" active={side === 'front'} onPress={() => setSide('front')} />
        <SideChip label="Back" active={side === 'back'} onPress={() => setSide('back')} />
      </View>

      <MuscleMapFigure
        data={bodyData}
        side={side}
        gender={gender}
        size="workout"
        framed
      />

      <MuscleProfileLabels profile={sideProfile} layout="grouped" />
    </View>
  );
}

function ExerciseMuscleRow({
  profile,
  sideProfile,
  bodyData,
  side,
  gender,
  size,
}: {
  profile: ExerciseMuscleProfile;
  sideProfile: ExerciseMuscleProfile;
  bodyData: ReturnType<typeof buildBodyHighlightData>;
  side: 'front' | 'back';
  gender: 'male' | 'female';
  size: 'active' | 'exercise';
}) {
  if (bodyData.length === 0) {
    return (
      <View style={styles.exerciseRow}>
        <MuscleProfileLabels profile={profile} layout="inline" />
      </View>
    );
  }

  return (
    <View style={[styles.exerciseRow, size === 'active' && styles.exerciseRowActive]}>
      <View style={styles.thumbnail}>
        <MuscleMapFigure data={bodyData} side={side} gender={gender} size={size} />
      </View>
      <MuscleProfileLabels profile={sideProfile} layout="inline" />
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
    <Pressable onPress={onPress} style={[styles.sideChip, active && styles.sideChipActive]}>
      <AppText variant="caption" color={active ? 'accent' : 'textSecondary'}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  workoutPanel: {
    width: '100%',
    gap: Spacing.md,
    alignItems: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  sideChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  sideChipActive: {
    borderColor: LiftFlowColors.accent,
    backgroundColor: LiftFlowColors.accentGlow,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LiftFlowColors.borderSubtle,
  },
  exerciseRowActive: {
    marginTop: 0,
    paddingTop: 0,
    borderTopWidth: 0,
  },
  thumbnail: {
    flexShrink: 0,
  },
});
