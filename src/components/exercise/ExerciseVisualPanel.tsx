import { useEffect, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { defaultViewForMuscles, muscleLabels } from '@/constants/muscles';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import type { ExerciseCardData } from '@/types/exerciseCard';
import type { UserProfile } from '@/types/user';
import { MuscleMapFigure, type FigureGender, type FigureSide } from './anatomy/MuscleMapFigure';

const VIEWS: { id: FigureSide; label: string }[] = [
  { id: 'front', label: 'Front' },
  { id: 'back', label: 'Back' },
];

const GENDERS: { id: FigureGender; label: string }[] = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
];

function initialSide(card: ExerciseCardData): FigureSide {
  return defaultViewForMuscles(card.primaryMuscles) === 'rear' ? 'back' : 'front';
}

function defaultGender(sex?: UserProfile['sex']): FigureGender {
  return sex === 'female' ? 'female' : 'male';
}

type ExerciseVisualPanelProps = {
  exercise: ExerciseCardData;
  /** When true the stage fills the hero card width with no outer gap. */
  embedded?: boolean;
};

export function ExerciseVisualPanel({ exercise, embedded }: ExerciseVisualPanelProps) {
  const { user } = useAuth();

  const [side, setSide] = useState<FigureSide>(() => initialSide(exercise));
  const [gender, setGender] = useState<FigureGender>(() => defaultGender(user?.sex));
  const [genderTouched, setGenderTouched] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!genderTouched) setGender(defaultGender(user?.sex));
  }, [user?.sex, genderTouched]);

  const screen = Dimensions.get('window');
  const panelHeight = Math.round(screen.height * 0.38);
  const controlsHeight = 44;
  const legendHeight = 44;
  const figureHeight = panelHeight - controlsHeight - legendHeight;

  const stage = (
    <View style={[styles.stage, { height: panelHeight }, embedded && styles.stageEmbedded]}>
      <View style={styles.controls}>
        <View style={styles.pillTabs}>
          {VIEWS.map((v) => (
            <Pressable
              key={v.id}
              onPress={() => setSide(v.id)}
              style={[styles.pillTab, side === v.id && styles.pillTabActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: side === v.id }}>
              <AppText variant="caption" style={side === v.id ? styles.tabTextActive : styles.tabText}>
                {v.label}
              </AppText>
            </Pressable>
          ))}
        </View>
        <View style={styles.pillTabs}>
          {GENDERS.map((g) => (
            <Pressable
              key={g.id}
              onPress={() => {
                setGenderTouched(true);
                setGender(g.id);
              }}
              style={[styles.pillTab, gender === g.id && styles.pillTabActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: gender === g.id }}>
              <AppText variant="caption" style={gender === g.id ? styles.tabTextActive : styles.tabText}>
                {g.label}
              </AppText>
            </Pressable>
          ))}
        </View>
        <Pressable
          style={styles.expandBtn}
          onPress={() => setFullscreen(true)}
          accessibilityRole="button"
          accessibilityLabel="View full screen">
          <AppText variant="caption" color="textSecondary">
            ⤢
          </AppText>
        </Pressable>
      </View>

      <View style={styles.figureWrap}>
        <MuscleMapFigure
          side={side}
          gender={gender}
          primaryMuscles={exercise.primaryMuscles}
          secondaryMuscles={exercise.secondaryMuscles}
          height={figureHeight}
        />
      </View>

      <View style={styles.inStageLegend}>
        <LegendRow color={LiftFlowColors.error} title="Primary" muscles={muscleLabels(exercise.primaryMuscles)} />
        {exercise.secondaryMuscles.length > 0 ? (
          <LegendRow color={LiftFlowColors.primary} title="Secondary" muscles={muscleLabels(exercise.secondaryMuscles)} />
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={embedded ? undefined : styles.standalone}>
      {stage}

      <Modal visible={fullscreen} animationType="fade" onRequestClose={() => setFullscreen(false)}>
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalClose}
            onPress={() => setFullscreen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close full screen">
            <AppText variant="bodyBold" color="textPrimary">
              ✕
            </AppText>
          </Pressable>
          <AppText variant="headline" align="center">
            {exercise.name}
          </AppText>
          <View style={[styles.stage, styles.modalStage, { height: Math.round(screen.height * 0.62) }]}>
            <View style={styles.controls}>
              <View style={styles.pillTabs}>
                {VIEWS.map((v) => (
                  <Pressable
                    key={v.id}
                    onPress={() => setSide(v.id)}
                    style={[styles.pillTab, side === v.id && styles.pillTabActive]}>
                    <AppText variant="caption" style={side === v.id ? styles.tabTextActive : styles.tabText}>
                      {v.label}
                    </AppText>
                  </Pressable>
                ))}
              </View>
              <View style={styles.pillTabs}>
                {GENDERS.map((g) => (
                  <Pressable
                    key={g.id}
                    onPress={() => {
                      setGenderTouched(true);
                      setGender(g.id);
                    }}
                    style={[styles.pillTab, gender === g.id && styles.pillTabActive]}>
                    <AppText variant="caption" style={gender === g.id ? styles.tabTextActive : styles.tabText}>
                      {g.label}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.figureWrap}>
              <MuscleMapFigure
                side={side}
                gender={gender}
                primaryMuscles={exercise.primaryMuscles}
                secondaryMuscles={exercise.secondaryMuscles}
                height={Math.round(screen.height * 0.48)}
              />
            </View>
            <View style={styles.inStageLegend}>
              <LegendRow color={LiftFlowColors.error} title="Primary" muscles={muscleLabels(exercise.primaryMuscles)} />
              {exercise.secondaryMuscles.length > 0 ? (
                <LegendRow
                  color={LiftFlowColors.primary}
                  title="Secondary"
                  muscles={muscleLabels(exercise.secondaryMuscles)}
                />
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function LegendRow({ color, title, muscles }: { color: string; title: string; muscles: string[] }) {
  return (
    <View style={styles.legendRow}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <AppText variant="caption" style={styles.legendLabel}>
        {title}:
      </AppText>
      <AppText variant="caption" style={styles.legendMuscles}>
        {muscles.join(' · ')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  standalone: {
    marginTop: Spacing.md,
  },
  stage: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(8, 11, 16, 0.08)',
    overflow: 'hidden',
  },
  stageEmbedded: {
    borderRadius: Radius.md,
    marginTop: Spacing.lg,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    height: 44,
  },
  pillTabs: {
    flexDirection: 'row',
    gap: 2,
    backgroundColor: 'rgba(8, 11, 16, 0.06)',
    borderRadius: Radius.full,
    padding: 2,
  },
  pillTab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  pillTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  tabText: {
    color: '#6B7589',
  },
  tabTextActive: {
    color: '#1A1F2B',
  },
  expandBtn: {
    position: 'absolute',
    right: Spacing.sm,
    top: Spacing.sm,
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(8, 11, 16, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  figureWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  inStageLegend: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(8, 11, 16, 0.06)',
    paddingTop: Spacing.sm,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    color: '#6B7589',
  },
  legendMuscles: {
    flex: 1,
    color: '#1A1F2B',
  },
  modalRoot: {
    flex: 1,
    backgroundColor: LiftFlowColors.background,
    paddingTop: Spacing.huge,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.lg,
  },
  modalClose: {
    position: 'absolute',
    top: Spacing.huge,
    right: Spacing.xl,
    zIndex: 3,
  },
  modalStage: {
    alignSelf: 'stretch',
  },
});
