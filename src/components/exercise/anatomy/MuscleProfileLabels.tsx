import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { muscleLabel } from '@/constants/muscles';
import { Radius, Spacing } from '@/constants/theme';
import {
    MUSCLE_HIGHLIGHT_PRIMARY,
    MUSCLE_HIGHLIGHT_SECONDARY,
    type ExerciseMuscleProfile,
} from '@/lib/exerciseMuscleMap';

type MuscleProfileLabelsProps = {
  profile: ExerciseMuscleProfile;
  layout?: 'grouped' | 'inline';
};

export function MuscleProfileLabels({ profile, layout = 'grouped' }: MuscleProfileLabelsProps) {
  if (profile.primary.length === 0 && profile.secondary.length === 0) return null;

  if (layout === 'inline') {
    return (
      <View style={styles.inlineBlock}>
        {profile.primary.length > 0 ? (
          <MuscleLine
            heading="Primary"
            muscles={profile.primary}
            color={MUSCLE_HIGHLIGHT_PRIMARY}
          />
        ) : null}
        {profile.secondary.length > 0 ? (
          <MuscleLine
            heading="Secondary"
            muscles={profile.secondary}
            color={MUSCLE_HIGHLIGHT_SECONDARY}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.grouped}>
      {profile.primary.length > 0 ? (
        <MuscleGroup
          heading="Primary"
          muscles={profile.primary}
          color={MUSCLE_HIGHLIGHT_PRIMARY}
        />
      ) : null}
      {profile.secondary.length > 0 ? (
        <MuscleGroup
          heading="Secondary"
          muscles={profile.secondary}
          color={MUSCLE_HIGHLIGHT_SECONDARY}
        />
      ) : null}
    </View>
  );
}

function MuscleGroup({
  heading,
  muscles,
  color,
}: {
  heading: string;
  muscles: ExerciseMuscleProfile['primary'];
  color: string;
}) {
  return (
    <View style={styles.group}>
      <View style={styles.groupHeading}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <AppText variant="caption" color="textTertiary">
          {heading}
        </AppText>
      </View>
      <AppText variant="footnote" color="textSecondary">
        {muscles.map(muscleLabel).join(' · ')}
      </AppText>
    </View>
  );
}

function MuscleLine({
  heading,
  muscles,
  color,
}: {
  heading: string;
  muscles: ExerciseMuscleProfile['primary'];
  color: string;
}) {
  return (
    <View style={styles.line}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <AppText variant="caption" color="textTertiary" style={styles.lineHeading}>
        {heading}:
      </AppText>
      <AppText variant="caption" color="textSecondary" style={styles.lineValues}>
        {muscles.map(muscleLabel).join(' · ')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  grouped: {
    width: '100%',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  group: {
    gap: 2,
  },
  groupHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  inlineBlock: {
    flex: 1,
    gap: Spacing.xs,
    justifyContent: 'center',
  },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  lineHeading: {
    minWidth: 68,
  },
  lineValues: {
    flex: 1,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: Radius.full,
    marginTop: 4,
  },
});
