import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { useTabSwipeNavigation } from '@/hooks/useTabSwipeNavigation';

type TabSwipeShellProps = {
  children: ReactNode;
  enabled?: boolean;
};

export function TabSwipeShell({ children, enabled = true }: TabSwipeShellProps) {
  const { enabled: routeEnabled, goToAdjacentTab } = useTabSwipeNavigation();
  const active = enabled && routeEnabled;

  const gesture = Gesture.Pan()
    .enabled(active)
    .activeOffsetX([-28, 28])
    .failOffsetY([-18, 18])
    .onEnd((event) => {
      const { translationX, velocityX } = event;
      if (translationX < -72 || velocityX < -450) {
        runOnJS(goToAdjacentTab)(1);
        return;
      }
      if (translationX > 72 || velocityX > 450) {
        runOnJS(goToAdjacentTab)(-1);
      }
    });

  if (!active) {
    return <>{children}</>;
  }

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.root}>{children}</View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
