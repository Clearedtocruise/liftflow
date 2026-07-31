import { useCallback, useEffect, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import {
    clamp,
    DOUBLE_TAP_ZOOM,
    MAX_ZOOM,
    MIN_ZOOM,
    maxPanOffset,
} from '@/lib/photoCompare';

export type PhotoZoomSource = {
  uri: string;
  label: string;
  caption?: string;
};

type PhotoZoomViewerProps = {
  visible: boolean;
  photos: PhotoZoomSource[];
  initialIndex?: number;
  onClose: () => void;
};

/**
 * Fullscreen progress-photo viewer: pinch to zoom, drag to pan, double-tap to toggle.
 *
 * Panning is only claimed once the image is zoomed in, so at fit scale the gesture stays
 * available for switching photos rather than fighting a drag that cannot move anything.
 */
export function PhotoZoomViewer({
  visible,
  photos,
  initialIndex = 0,
  onClose,
}: PhotoZoomViewerProps) {
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);

  const scale = useSharedValue(MIN_ZOOM);
  const savedScale = useSharedValue(MIN_ZOOM);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const stageWidth = width;
  const stageHeight = height * 0.72;

  const resetTransform = useCallback(() => {
    scale.value = withTiming(MIN_ZOOM);
    savedScale.value = MIN_ZOOM;
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    setZoomed(false);
  }, [scale, savedScale, translateX, translateY, savedTranslateX, savedTranslateY]);

  useEffect(() => {
    if (visible) {
      setIndex(initialIndex);
      resetTransform();
    }
  }, [visible, initialIndex, resetTransform]);

  const photo = photos[index];

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = clamp(savedScale.value * event.scale, MIN_ZOOM, MAX_ZOOM);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= MIN_ZOOM + 0.01) {
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
      runOnJS(setZoomed)(scale.value > MIN_ZOOM + 0.01);
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    // At fit scale there is nothing to pan, so the gesture must not swallow the touch.
    .enabled(zoomed)
    .onUpdate((event) => {
      const maxX = maxPanOffset(stageWidth, scale.value);
      const maxY = maxPanOffset(stageHeight, scale.value);
      translateX.value = clamp(savedTranslateX.value + event.translationX, -maxX, maxX);
      translateY.value = clamp(savedTranslateY.value + event.translationY, -maxY, maxY);
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const zoomingIn = scale.value <= MIN_ZOOM + 0.01;
      const next = zoomingIn ? DOUBLE_TAP_ZOOM : MIN_ZOOM;
      scale.value = withTiming(next);
      savedScale.value = next;
      if (!zoomingIn) {
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
      runOnJS(setZoomed)(zoomingIn);
    });

  const composed = Gesture.Simultaneous(pinch, Gesture.Exclusive(doubleTap, pan));

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  function step(delta: number) {
    const next = index + delta;
    if (next < 0 || next >= photos.length) return;
    setIndex(next);
    resetTransform();
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="overFullScreen"
      transparent
      onRequestClose={onClose}>
      {/* Gestures inside an RN Modal need their own root on Android. */}
      <GestureHandlerRootView style={styles.root}>
        <View style={styles.topBar}>
          <View style={styles.topBarText}>
            <AppText variant="bodyBold">{photo?.label ?? 'Photo'}</AppText>
            {photo?.caption ? (
              <AppText variant="caption" color="textSecondary">
                {photo.caption}
              </AppText>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close photo"
            hitSlop={12}
            onPress={onClose}>
            <AppText variant="bodyBold" color="accent">
              Close
            </AppText>
          </Pressable>
        </View>

        <GestureDetector gesture={composed}>
          <View style={[styles.stage, { width: stageWidth, height: stageHeight }]}>
            {photo ? (
              <Animated.View style={[styles.imageWrap, imageStyle]}>
                <Image
                  source={{ uri: photo.uri }}
                  style={{ width: stageWidth, height: stageHeight }}
                  resizeMode="contain"
                  accessibilityLabel={photo.label}
                />
              </Animated.View>
            ) : null}
          </View>
        </GestureDetector>

        <View style={styles.bottomBar}>
          {photos.length > 1 ? (
            <View style={styles.navRow}>
              <Pressable
                style={[styles.navButton, index === 0 && styles.navButtonDisabled]}
                disabled={index === 0}
                accessibilityRole="button"
                accessibilityLabel="Previous photo"
                onPress={() => step(-1)}>
                <AppText variant="bodyBold">‹</AppText>
              </Pressable>
              <AppText variant="caption" color="textSecondary">
                {index + 1} of {photos.length}
              </AppText>
              <Pressable
                style={[styles.navButton, index === photos.length - 1 && styles.navButtonDisabled]}
                disabled={index === photos.length - 1}
                accessibilityRole="button"
                accessibilityLabel="Next photo"
                onPress={() => step(1)}>
                <AppText variant="bodyBold">›</AppText>
              </Pressable>
            </View>
          ) : null}
          <AppText variant="caption" color="textTertiary" align="center">
            Pinch to zoom · drag to move · double-tap to reset
          </AppText>
          {zoomed ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reset zoom"
              onPress={resetTransform}>
              <AppText variant="caption" color="accent" align="center">
                Reset zoom
              </AppText>
            </Pressable>
          ) : null}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(4,6,10,0.97)',
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingTop: Spacing.huge,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  topBarText: {
    flex: 1,
    gap: 2,
  },
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imageWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.huge,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navButton: {
    minWidth: 56,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    alignItems: 'center',
  },
  navButtonDisabled: {
    opacity: 0.35,
  },
});
