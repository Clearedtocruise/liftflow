import { LinearGradient } from 'expo-linear-gradient';
import { Component, type ErrorInfo, type ReactNode, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Body, { type ExtendedBodyPart } from 'react-native-body-highlighter';

import type { AppTheme } from '@/constants/themes';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useThemedStyles } from '@/hooks/useLiftFlowTheme';
import {
    MUSCLE_HIGHLIGHT_PRIMARY,
    MUSCLE_HIGHLIGHT_SECONDARY,
    muscleFigureBodyColors,
    muscleFigureFrameGradient,
} from '@/lib/exerciseMuscleMap';

/** SVG native size is 200×400 at scale 1. */
const SVG_BASE_WIDTH = 200;
const SVG_BASE_HEIGHT = 400;

export type MuscleFigureSize = 'workout' | 'active' | 'exercise';

const SIZE_SCALE: Record<MuscleFigureSize, number> = {
  workout: 0.68,
  active: 0.5,
  exercise: 0.36,
};

type MuscleMapFigureProps = {
  data: ExtendedBodyPart[];
  side?: 'front' | 'back';
  gender?: 'male' | 'female';
  size?: MuscleFigureSize;
  /** Override preset scale when needed. */
  scale?: number;
  framed?: boolean;
};

type BoundaryProps = {
  children: ReactNode;
};

type BoundaryState = {
  failed: boolean;
};

class MuscleMapErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Swallow render errors — parent screens stay usable without the figure.
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

export function muscleFigureDimensions(size: MuscleFigureSize, scaleOverride?: number) {
  const scale = scaleOverride ?? SIZE_SCALE[size];
  return {
    scale,
    width: SVG_BASE_WIDTH * scale,
    height: SVG_BASE_HEIGHT * scale,
  };
}

export function MuscleMapFigure({
  data,
  side = 'front',
  gender = 'male',
  size = 'workout',
  scale: scaleOverride,
  framed = false,
}: MuscleMapFigureProps) {
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const bodyColors = useMemo(() => muscleFigureBodyColors(theme.isDark), [theme.isDark]);
  const frameGradient = useMemo(
    () => muscleFigureFrameGradient(theme.isDark, theme.colors.surface),
    [theme.isDark, theme.colors.surface],
  );

  const { scale, width, height } = useMemo(
    () => muscleFigureDimensions(size, scaleOverride),
    [size, scaleOverride],
  );

  if (!data.length) return null;

  const figure = (
    <View style={[styles.figureSlot, { width, height }]}>
      <Body
        data={data}
        side={side}
        gender={gender}
        scale={scale}
        colors={[MUSCLE_HIGHLIGHT_SECONDARY, MUSCLE_HIGHLIGHT_PRIMARY]}
        border="none"
        defaultFill={bodyColors.fill}
        defaultStroke={bodyColors.stroke}
        defaultStrokeWidth={0.4}
      />
    </View>
  );

  return (
    <MuscleMapErrorBoundary>
      {framed ? (
        <LinearGradient
          colors={[...frameGradient]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.frame}>
          <View style={styles.frameInner}>{figure}</View>
        </LinearGradient>
      ) : (
        figure
      )}
    </MuscleMapErrorBoundary>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    frame: {
      width: '100%',
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'visible',
    },
    frameInner: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.md,
    },
    figureSlot: {
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
