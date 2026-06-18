import { StyleSheet, View, type ViewStyle } from 'react-native';

import { LiftFlowColors, Radius } from '@/constants/theme';

type SkeletonBlockProps = {
  height: number;
  width?: number | `${number}%`;
  style?: ViewStyle;
};

export function SkeletonBlock({ height, width = '100%', style }: SkeletonBlockProps) {
  return <View style={[styles.block, { height, width }, style]} />;
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: LiftFlowColors.backgroundSecondary,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
});
