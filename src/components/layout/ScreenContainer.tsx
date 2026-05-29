import { ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LiftFlowColors, Spacing, TabBarHeight } from '@/constants/theme';

type ScreenContainerProps = ScrollViewProps & {
  scroll?: boolean;
  padded?: boolean;
  bottomInset?: boolean;
  children: React.ReactNode;
};

export function ScreenContainer({
  scroll = true,
  padded = true,
  bottomInset = true,
  style,
  contentContainerStyle,
  children,
  ...rest
}: ScreenContainerProps) {
  const insets = useSafeAreaInsets();

  const paddingBottom = bottomInset
    ? insets.bottom + TabBarHeight + Spacing.lg
    : insets.bottom + Spacing.lg;

  const content = (
    <View
      style={[
        styles.inner,
        padded && styles.padded,
        { paddingTop: insets.top + Spacing.lg, paddingBottom },
        !scroll && style,
      ]}>
      {children}
    </View>
  );

  if (!scroll) {
    return <View style={[styles.root, style]}>{content}</View>;
  }

  return (
    <ScrollView
      style={[styles.root, style]}
      contentContainerStyle={[contentContainerStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      {...rest}>
      {content}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LiftFlowColors.background,
  },
  inner: {
    flexGrow: 1,
  },
  padded: {
    paddingHorizontal: Spacing.xl,
  },
});
