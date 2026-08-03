import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Gradients, LiftFlowColors } from '@/constants/theme';

/**
 * The raised centre button in the tab bar.
 *
 * Rendered as a tab `tabBarButton` so it keeps its slot in the bar's layout, but it navigates
 * nowhere itself — the caller opens a sheet of things to add.
 */
export function TabQuickAddButton({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.slot}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Quick add"
        hitSlop={8}
        onPress={onPress}
        style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}>
        <LinearGradient
          colors={[...Gradients.action]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.circle}>
          <AppText variant="headline" style={styles.plus}>
            +
          </AppText>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    flex: 1,
    alignItems: 'center',
  },
  pressable: {
    // Lifts the button above the bar without changing the bar's own height.
    marginTop: -22,
  },
  pressed: {
    opacity: 0.85,
  },
  circle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: LiftFlowColors.tabBar,
  },
  plus: {
    color: '#FFFFFF',
    lineHeight: 30,
  },
});
