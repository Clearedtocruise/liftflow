import { LinearGradient } from 'expo-linear-gradient';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LiftFlowColors, Spacing, TabBarHeight } from '@/constants/theme';

type ScreenContainerProps = ScrollViewProps & {
  scroll?: boolean;
  padded?: boolean;
  bottomInset?: boolean;
  ambient?: boolean;
  keyboardAvoiding?: boolean;
  keyboardVerticalOffset?: number;
  children: React.ReactNode;
};

export function ScreenContainer({
  scroll = true,
  padded = true,
  bottomInset = true,
  ambient = true,
  keyboardAvoiding = false,
  keyboardVerticalOffset = 0,
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
    return (
      <View style={[styles.root, style]}>
        {ambient ? (
          <LinearGradient
            colors={['rgba(31, 107, 255, 0.07)', 'transparent']}
            style={styles.ambient}
            pointerEvents="none"
          />
        ) : null}
        {content}
      </View>
    );
  }

  if (keyboardAvoiding) {
    return (
      <View style={styles.root}>
        {ambient ? (
          <LinearGradient
            colors={['rgba(31, 107, 255, 0.07)', 'transparent']}
            style={styles.ambient}
            pointerEvents="none"
          />
        ) : null}
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={keyboardVerticalOffset}>
          <ScrollView
            style={[styles.flex, style]}
            contentContainerStyle={[contentContainerStyle]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            {...rest}>
            {content}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {ambient ? (
        <LinearGradient
          colors={['rgba(31, 107, 255, 0.07)', 'transparent']}
          style={styles.ambient}
          pointerEvents="none"
        />
      ) : null}
      <ScrollView
        style={[styles.flex, style]}
        contentContainerStyle={[contentContainerStyle]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        {...rest}>
        {content}
      </ScrollView>
    </View>
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
  inner: {
    flexGrow: 1,
  },
  padded: {
    paddingHorizontal: Spacing.xl,
  },
});
