import { LinearGradient } from 'expo-linear-gradient';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LiftFlowWordmark } from '@/components/brand/LiftFlowWordmark';
import { LogoMark } from '@/components/brand/LogoMark';
import { AppText } from '@/components/ui/AppText';
import { Brand, LiftFlowColors, Spacing } from '@/constants/theme';

type AuthFormContainerProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function AuthFormContainer({ title, subtitle, children }: AuthFormContainerProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['rgba(31, 107, 255, 0.12)', 'transparent', 'transparent']}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        style={[styles.inner, { paddingTop: insets.top + Spacing.xxl, paddingBottom: insets.bottom + Spacing.xl }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.brandRow}>
          <LogoMark size={48} glow />
          <View style={styles.brandText}>
            <LiftFlowWordmark size="sm" align="left" showTagline />
          </View>
        </View>

        <View style={styles.header}>
          <AppText variant="title">{title}</AppText>
          {subtitle ? (
            <AppText variant="body" color="textSecondary">
              {subtitle}
            </AppText>
          ) : null}
        </View>
        <View style={styles.form}>{children}</View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LiftFlowColors.background,
  },
  inner: {
    flex: 1,
    paddingHorizontal: Spacing.xxl,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.xxxl,
  },
  brandText: {
    gap: 2,
  },
  header: {
    gap: Spacing.sm,
    marginBottom: Spacing.xxl,
  },
  form: {
    gap: Spacing.lg,
  },
});
