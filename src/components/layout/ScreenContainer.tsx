import { LinearGradient } from 'expo-linear-gradient';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabSwipeShell } from '@/components/layout/TabSwipeShell';
import { LiftFlowColors, Spacing, TabBarHeight } from '@/constants/theme';

type ScreenContainerProps = ScrollViewProps & {
  scroll?: boolean;
  padded?: boolean;
  bottomInset?: boolean;
  ambient?: boolean;
  /** Renders above the scroll area so titles stay visible while scrolling. */
  header?: React.ReactNode;
  /** Extra padding when keyboard is open — keeps submit buttons visible. */
  keyboardExtraPadding?: number;
  /** Horizontal swipe between main tabs (Home ↔ Workout ↔ …). */
  enableTabSwipe?: boolean;
  testID?: string;
  children: React.ReactNode;
};

export function ScreenContainer({
  scroll = true,
  padded = true,
  bottomInset = true,
  ambient = true,
  header,
  keyboardExtraPadding = 16,
  enableTabSwipe = true,
  testID,
  style,
  contentContainerStyle,
  children,
  keyboardShouldPersistTaps = 'handled',
  keyboardDismissMode = 'interactive',
  ...rest
}: ScreenContainerProps) {
  const insets = useSafeAreaInsets();

  const paddingBottom = bottomInset
    ? insets.bottom + TabBarHeight + Spacing.lg + keyboardExtraPadding
    : insets.bottom + Spacing.lg + keyboardExtraPadding;

  const headerBlock = header ? (
    <View
      style={[
        styles.stickyHeader,
        padded && styles.padded,
        { paddingTop: insets.top + Spacing.md },
      ]}>
      {header}
    </View>
  ) : null;

  const contentTopPadding = header ? Spacing.md : insets.top + Spacing.lg;

  const inner = (
    <View
      testID={testID}
      style={[
        styles.inner,
        padded && styles.padded,
        { paddingTop: contentTopPadding, paddingBottom: scroll ? undefined : paddingBottom },
        !scroll && style,
      ]}>
      {children}
    </View>
  );

  const ambientLayer = ambient ? (
    <LinearGradient
      colors={['rgba(14, 144, 255, 0.07)', 'transparent']}
      style={styles.ambient}
      pointerEvents="none"
    />
  ) : null;

  if (!scroll) {
    return (
      <TabSwipeShell enabled={enableTabSwipe}>
        <KeyboardAvoidingView
          style={[styles.root, style]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {ambientLayer}
          {headerBlock}
          {inner}
        </KeyboardAvoidingView>
      </TabSwipeShell>
    );
  }

  return (
    <TabSwipeShell enabled={enableTabSwipe}>
      <View style={styles.root}>
        {ambientLayer}
        {headerBlock}
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            style={[styles.flex, style]}
            contentContainerStyle={[contentContainerStyle]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps={keyboardShouldPersistTaps}
            keyboardDismissMode={keyboardDismissMode}
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            {...rest}>
            <View
              style={[
                styles.inner,
                padded && styles.padded,
                { paddingTop: contentTopPadding, paddingBottom },
              ]}>
              {children}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </TabSwipeShell>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LiftFlowColors.background,
  },
  flex: {
    flex: 1,
  },
  ambient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 220,
    zIndex: 0,
  },
  stickyHeader: {
    zIndex: 1,
    backgroundColor: LiftFlowColors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LiftFlowColors.border,
    paddingBottom: Spacing.sm,
  },
  inner: {
    flexGrow: 1,
  },
  padded: {
    paddingHorizontal: Spacing.xl,
  },
});
