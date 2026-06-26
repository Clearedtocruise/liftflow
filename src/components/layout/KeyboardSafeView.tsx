import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type KeyboardSafeScrollProps = ScrollViewProps & {
  children: React.ReactNode;
  /** Extra space below content so submit buttons stay above the keyboard. */
  extraBottomPadding?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

/** Scroll + keyboard avoidance for forms with text fields and action buttons. */
export function KeyboardSafeScroll({
  children,
  extraBottomPadding = 32,
  contentContainerStyle,
  keyboardShouldPersistTaps = 'handled',
  keyboardDismissMode = 'interactive',
  ...rest
}: KeyboardSafeScrollProps) {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
      <ScrollView
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        keyboardDismissMode={keyboardDismissMode}
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        contentContainerStyle={[
          { paddingBottom: extraBottomPadding + insets.bottom },
          contentContainerStyle,
        ]}
        showsVerticalScrollIndicator={false}
        {...rest}>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type KeyboardSafeModalProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Wrap modal content so fields and buttons stay visible when the keyboard opens. */
export function KeyboardSafeModal({ children, style }: KeyboardSafeModalProps) {
  return (
    <KeyboardAvoidingView
      style={[styles.flex, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
