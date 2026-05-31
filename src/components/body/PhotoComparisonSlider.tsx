import { useRef, useState } from 'react';
import { Image, PanResponder, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';

type PhotoComparisonSliderProps = {
  leftLabel: string;
  rightLabel: string;
  leftUri?: string;
  rightUri?: string;
  height?: number;
};

export function PhotoComparisonSlider({
  leftLabel,
  rightLabel,
  leftUri,
  rightUri,
  height = 220,
}: PhotoComparisonSliderProps) {
  const [width, setWidth] = useState(0);
  const [split, setSplit] = useState(0.5);
  const splitRef = useRef(0.5);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        if (width <= 0) return;
        const next = Math.min(0.95, Math.max(0.05, gesture.moveX / width));
        splitRef.current = next;
        setSplit(next);
      },
    }),
  ).current;

  if (!leftUri && !rightUri) {
    return (
      <View style={[styles.empty, { height }]}>
        <AppText variant="caption" color="textTertiary">
          Add photos to compare
        </AppText>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.labels}>
        <AppText variant="caption" color="textSecondary">
          {leftLabel}
        </AppText>
        <AppText variant="caption" color="textSecondary">
          {rightLabel}
        </AppText>
      </View>
      <View
        style={[styles.frame, { height }]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        {...pan.panHandlers}>
        {rightUri ? <Image source={{ uri: rightUri }} style={styles.fullImage} /> : null}
        {leftUri ? (
          <View style={[styles.leftClip, { width: `${split * 100}%` }]}>
            <Image source={{ uri: leftUri }} style={[styles.fullImage, { width }]} />
          </View>
        ) : null}
        <View style={[styles.handle, { left: `${split * 100}%` }]}>
          <View style={styles.handleBar} />
        </View>
      </View>
      <AppText variant="caption" color="textTertiary">
        Drag to compare
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  frame: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: LiftFlowColors.surface,
  },
  fullImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  leftClip: { position: 'absolute', top: 0, bottom: 0, left: 0, overflow: 'hidden' },
  handle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  handleBar: {
    width: 4,
    height: '100%',
    backgroundColor: LiftFlowColors.accent,
    borderRadius: 2,
  },
  empty: {
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
