import { LinearGradient } from 'expo-linear-gradient';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabSwipeShell } from '@/components/layout/TabSwipeShell';
import type { AppTheme } from '@/constants/themes';
import { TabBarHeight } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useThemedStyles } from '@/hooks/useLiftFlowTheme';

type ScreenContainerProps = ScrollViewProps & {
  scroll?: boolean;
  padded?: boolean;
  bottomInset?: boolean;
  ambient?: boolean;
  contentGap?: number;
  header?: React.ReactNode;
  keyboardExtraPadding?: number;
  enableTabSwipe?: boolean;
  testID?: string;
  children: React.ReactNode;
};

export function ScreenContainer({
  scroll = true,
  padded = true,
  bottomInset = true,
  ambient = true,
  contentGap,
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
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const gap = contentGap ?? theme.spacing.lg;
  const insets = useSafeAreaInsets();

  const paddingBottom = bottomInset
    ? insets.bottom + TabBarHeight + theme.spacing.lg + keyboardExtraPadding
    : insets.bottom + theme.spacing.lg + keyboardExtraPadding;

  const headerBlock = header ? (
    <View
      style={[
        styles.stickyHeader,
        padded && styles.padded,
        { paddingTop: insets.top + theme.spacing.md },
      ]}>
      {header}
    </View>
  ) : null;

  const contentTopPadding = header ? theme.spacing.md : insets.top + theme.spacing.lg;

  const innerStyle = [
    styles.inner,
    padded && styles.padded,
    gap > 0 && { gap },
    { paddingTop: contentTopPadding, paddingBottom: scroll ? undefined : paddingBottom },
    !scroll && style,
  ];

  const inner = (
    <View testID={testID} style={innerStyle}>
      {children}
    </View>
  );

  const ambientLayer = ambient ? (
    <LinearGradient
      colors={[...theme.brandGradients.ambient]}
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
                gap > 0 && { gap },
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

/** App shell alias — safe area, background, padding. */
export const AppScreen = ScreenContainer;

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
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
      backgroundColor: theme.colors.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
      paddingBottom: theme.spacing.sm,
    },
    inner: {
      flexGrow: 1,
    },
    padded: {
      paddingHorizontal: theme.spacing.xl,
    },
  });
}
