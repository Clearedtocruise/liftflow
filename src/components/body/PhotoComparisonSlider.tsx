import { useCallback, useRef, useState } from 'react';
import { Image, PanResponder, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { splitFromTouch } from '@/lib/photoCompare';

type PhotoComparisonSliderProps = {
  leftLabel: string;
  rightLabel: string;
  leftUri?: string;
  rightUri?: string;
  height?: number;
  /** Opens the fullscreen zoom viewer. */
  onExpand?: (which: 'left' | 'right') => void;
};

export function PhotoComparisonSlider({
  leftLabel,
  rightLabel,
  leftUri,
  rightUri,
  height = 220,
  onExpand,
}: PhotoComparisonSliderProps) {
  const [width, setWidth] = useState(0);
  const [split, setSplit] = useState(0.5);
  const [dragging, setDragging] = useState(false);

  // The PanResponder is created once, so it must read layout through refs. Reading the `width`
  // state directly captured 0 forever and every drag bailed out before moving the handle.
  const widthRef = useRef(0);
  const frameXRef = useRef(0);
  const frameRef = useRef<View>(null);

  const measureFrame = useCallback(() => {
    frameRef.current?.measureInWindow((x, _y, measuredWidth) => {
      frameXRef.current = x;
      if (measuredWidth > 0) {
        widthRef.current = measuredWidth;
        setWidth(measuredWidth);
      }
    });
  }, []);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        setDragging(true);
        // pageX is absolute; the frame is inset by the card padding, so subtract its origin.
        setSplit(splitFromTouch(event.nativeEvent.pageX, frameXRef.current, widthRef.current));
      },
      onPanResponderMove: (event, gesture) => {
        const touchX = event.nativeEvent.pageX || gesture.moveX;
        setSplit(splitFromTouch(touchX, frameXRef.current, widthRef.current));
      },
      onPanResponderRelease: () => setDragging(false),
      onPanResponderTerminate: () => setDragging(false),
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

  const hasBoth = Boolean(leftUri && rightUri);

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
        ref={frameRef}
        style={[styles.frame, { height }]}
        onLayout={(e) => {
          widthRef.current = e.nativeEvent.layout.width;
          setWidth(e.nativeEvent.layout.width);
          measureFrame();
        }}
        {...pan.panHandlers}>
        {rightUri ? <Image source={{ uri: rightUri }} style={styles.fullImage} /> : null}
        {leftUri ? (
          <View style={[styles.leftClip, { width: `${split * 100}%` }]}>
            <Image source={{ uri: leftUri }} style={[styles.fullImage, { width }]} />
          </View>
        ) : null}
        {hasBoth ? (
          <View style={[styles.handle, { left: `${split * 100}%` }]} pointerEvents="none">
            <View style={styles.handleBar} />
            <View style={[styles.handleKnob, dragging && styles.handleKnobActive]}>
              <AppText variant="caption" color="background">
                ‹ ›
              </AppText>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        <AppText variant="caption" color="textTertiary">
          {hasBoth ? 'Drag to compare' : 'Add a second photo to compare'}
        </AppText>
        {onExpand ? (
          <View style={styles.expandRow}>
            {leftUri ? (
              <Pressable
                style={styles.expandButton}
                accessibilityRole="button"
                accessibilityLabel={`Zoom ${leftLabel} photo`}
                onPress={() => onExpand('left')}>
                <AppText variant="caption" color="accent">
                  Zoom {leftLabel}
                </AppText>
              </Pressable>
            ) : null}
            {rightUri ? (
              <Pressable
                style={styles.expandButton}
                accessibilityRole="button"
                accessibilityLabel={`Zoom ${rightLabel} photo`}
                onPress={() => onExpand('right')}>
                <AppText variant="caption" color="accent">
                  Zoom {rightLabel}
                </AppText>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
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
  handleKnob: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: LiftFlowColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleKnobActive: {
    transform: [{ scale: 1.12 }],
  },
  footer: {
    gap: Spacing.xs,
  },
  expandRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  expandButton: {
    flex: 1,
    minHeight: TouchTarget.min,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
