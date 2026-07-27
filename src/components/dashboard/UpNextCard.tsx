import { Pressable, StyleSheet, View } from 'react-native';

import { MuscleMapFigure } from '@/components/exercise/anatomy/MuscleMapFigure';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { buildBodyHighlightData, resolveBodySide, type ExerciseMuscleProfile } from '@/lib/exerciseMuscleMap';

/** The anatomy SVG is 200×400, so the slot keeps that 1:2 ratio and the scale fits it inside. */
const THUMB_SCALE = 0.2;
const THUMB_WIDTH = 200 * THUMB_SCALE + 8;
const THUMB_HEIGHT = 400 * THUMB_SCALE + 8;

type UpNextCardProps = {
  /** e.g. "Tomorrow", or a weekday for anything further out. */
  when: string;
  name: string;
  focus?: string;
  /** Drives the thumbnail, so the card shows what the session trains rather than a stock image. */
  muscles: ExerciseMuscleProfile;
  gender: 'male' | 'female';
  onPress: () => void;
};

export function UpNextCard({ when, name, focus, muscles, gender, onPress }: UpNextCardProps) {
  const side = resolveBodySide(muscles);
  const data = buildBodyHighlightData(muscles.primary, muscles.secondary, side);

  return (
    <View style={styles.card}>
      <View style={styles.thumb}>
        {data.length > 0 ? (
          // The figure is 200×400, so it needs a portrait slot and an explicit scale. Dropping it
          // into a square box only ever showed a cropped slice of the torso.
          <MuscleMapFigure data={data} side={side} gender={gender} scale={THUMB_SCALE} />
        ) : null}
      </View>

      <View style={styles.body}>
        <AppText variant="caption" color="accent">
          {when}
        </AppText>
        <AppText variant="bodyBold" numberOfLines={2}>
          {name}
        </AppText>
        {focus ? (
          <AppText variant="caption" color="textTertiary" numberOfLines={1}>
            {focus}
          </AppText>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View plan for ${name}`}
        onPress={onPress}
        style={({ pressed }) => [styles.pill, pressed && styles.pressed]}>
        <AppText variant="caption" color="accent">
          View Plan ›
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    backgroundColor: LiftFlowColors.surface,
  },
  thumb: {
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: LiftFlowColors.borderSubtle,
    backgroundColor: LiftFlowColors.backgroundSecondary,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  pill: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: LiftFlowColors.accent,
  },
  pressed: {
    opacity: 0.8,
  },
});
