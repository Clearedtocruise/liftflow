import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { muscleLabels } from '@/constants/muscles';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import type { ExerciseCardData } from '@/types/exerciseCard';
import { ExerciseVisualPanel } from './ExerciseVisualPanel';

type ExerciseHeroCardProps = {
  card: ExerciseCardData;
};

export function ExerciseHeroCard({ card }: ExerciseHeroCardProps) {
  const primary = muscleLabels(card.primaryMuscles);
  const secondary = muscleLabels(card.secondaryMuscles);

  return (
    <Card glow style={styles.hero}>
      <AppText variant="hero">{card.name.toUpperCase()}</AppText>

      <View style={styles.metaGrid}>
        <MetaBlock label="Primary" accent="error">
          {primary.map((m) => (
            <AppText key={m} variant="bodyBold" color="error">
              {m}
            </AppText>
          ))}
        </MetaBlock>

        {secondary.length > 0 ? (
          <MetaBlock label="Secondary" accent="primary">
            {secondary.map((m) => (
              <AppText key={m} variant="body" color="primary">
                {m}
              </AppText>
            ))}
          </MetaBlock>
        ) : (
          <MetaBlock label="Secondary" accent="primary">
            <AppText variant="body" color="textTertiary">
              —
            </AppText>
          </MetaBlock>
        )}

        <MetaBlock label="Difficulty">
          <AppText variant="bodyBold">{card.difficulty}</AppText>
        </MetaBlock>

        <MetaBlock label="Equipment">
          <AppText variant="body" color="textSecondary">
            {card.equipment}
          </AppText>
        </MetaBlock>
      </View>

      <ExerciseVisualPanel exercise={card} embedded />
    </Card>
  );
}

function MetaBlock({
  label,
  accent,
  children,
}: {
  label: string;
  accent?: 'error' | 'primary';
  children: ReactNode;
}) {
  return (
    <View style={styles.metaBlock}>
      <AppText variant="label" color={accent ?? 'textTertiary'}>
        {label}
      </AppText>
      <View style={styles.metaValues}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.lg,
    marginTop: Spacing.xs,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: LiftFlowColors.border,
  },
  metaBlock: {
    flexGrow: 1,
    flexBasis: '40%',
    gap: 4,
  },
  metaValues: {
    gap: 2,
  },
});
