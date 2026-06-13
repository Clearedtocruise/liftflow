import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Body, { type ExtendedBodyPart } from 'react-native-body-highlighter';

import { LiftFlowColors } from '@/constants/theme';

type MuscleMapFigureProps = {
  data: ExtendedBodyPart[];
  side?: 'front' | 'back';
  gender?: 'male' | 'female';
  scale?: number;
  height?: number;
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

export function MuscleMapFigure({
  data,
  side = 'front',
  gender = 'male',
  scale = 1.05,
  height = 200,
}: MuscleMapFigureProps) {
  if (!data.length) return null;

  return (
    <MuscleMapErrorBoundary>
      <View style={[styles.wrap, { height }]}>
        <Body
          data={data}
          side={side}
          gender={gender}
          scale={scale}
          colors={['#2E7DF6', '#FF3B30']}
          border="none"
          defaultFill={LiftFlowColors.backgroundSecondary}
          defaultStroke={LiftFlowColors.border}
          defaultStrokeWidth={0.6}
        />
      </View>
    </MuscleMapErrorBoundary>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
