import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';

type AuthFormContainerProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function AuthFormContainer({ title, subtitle, children }: AuthFormContainerProps) {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top + Spacing.xxxl, paddingBottom: insets.bottom + Spacing.xl }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <AppText variant="hero">{title}</AppText>
        {subtitle ? (
          <AppText variant="body" color="textSecondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <View style={styles.form}>{children}</View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LiftFlowColors.background,
    paddingHorizontal: Spacing.xxl,
  },
  header: {
    gap: Spacing.sm,
    marginBottom: Spacing.xxxl,
  },
  form: {
    gap: Spacing.lg,
  },
});
