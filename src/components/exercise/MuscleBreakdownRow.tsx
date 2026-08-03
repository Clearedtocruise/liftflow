import { StyleSheet, View } from 'react-native';

import { MuscleMapFigure } from '@/components/exercise/anatomy/MuscleMapFigure';
import { AppText } from '@/components/ui/AppText';
import {
    muscleAnatomicalName,
    muscleLabel,
    muscleVisibleOnSide,
    type MuscleId,
} from '@/constants/muscles';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { buildBodyHighlightData } from '@/lib/exerciseMuscleMap';

type MuscleBreakdownRowProps = {
  /** Rendered one figure per muscle, in the order the exercise emphasises them. */
  muscles: MuscleId[];
  gender: 'male' | 'female';
  /** Cap so a compound lift does not render a dozen tiny figures. */
  limit?: number;
};

/**
 * One highlighted figure per worked muscle, rather than a single figure with everything lit up.
 *
 * A combined map answers "what does this train"; separate figures answer "where is each of these",
 * which is the question somebody learning the movement is actually asking.
 */
export function MuscleBreakdownRow({ muscles, gender, limit = 4 }: MuscleBreakdownRowProps) {
  const shown = muscles.slice(0, limit);
  if (shown.length === 0) return null;

  return (
    <View style={styles.row}>
      {shown.map((muscle) => {
        // Show whichever view the muscle is actually visible from, so a lat lands on the back
        // figure and a pec on the front rather than every card defaulting to one side.
        const side: 'front' | 'back' = muscleVisibleOnSide(muscle, 'front') ? 'front' : 'back';
        const data = buildBodyHighlightData([muscle], [], side);
        if (data.length === 0) return null;

        return (
          <View key={muscle} style={styles.item}>
            <View style={styles.figure}>
              <MuscleMapFigure data={data} side={side} gender={gender} size="exercise" />
            </View>
            <AppText variant="caption" align="center" numberOfLines={1}>
              {muscleLabel(muscle).toUpperCase()}
            </AppText>
            <AppText variant="caption" color="textTertiary" align="center" numberOfLines={2}>
              {muscleAnatomicalName(muscle)}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-evenly',
    gap: Spacing.md,
  },
  item: {
    alignItems: 'center',
    gap: 2,
    minWidth: 72,
    maxWidth: 104,
    flexGrow: 1,
  },
  figure: {
    padding: Spacing.xs,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: LiftFlowColors.borderSubtle,
    backgroundColor: LiftFlowColors.backgroundSecondary,
    marginBottom: Spacing.xs,
  },
});
