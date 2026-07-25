import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LiftFlowWordmark } from '@/components/brand/LiftFlowWordmark';
import { LogoMark } from '@/components/brand/LogoMark';
import { AppText } from '@/components/ui/AppText';
import { HeroImages } from '@/constants/imagery';
import { LiftFlowColors, Spacing } from '@/constants/theme';

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
        colors={[LiftFlowColors.accentGlow, 'transparent', 'transparent']}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Scrollable so the password field and submit button stay reachable on short screens
            once the keyboard is up — previously the form was simply clipped. */}
        <ScrollView
          contentContainerStyle={[
            styles.inner,
            { paddingTop: insets.top + Spacing.xxl, paddingBottom: insets.bottom + Spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.brandBlock}>
          <Image source={{ uri: HeroImages.welcome }} style={styles.heroImage} contentFit="cover" />
          <LogoMark size={48} glow />
          <LiftFlowWordmark size="sm" align="center" showTagline />
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
        </ScrollView>
      </KeyboardAvoidingView>
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
  inner: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xxl,
  },
  brandBlock: {
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.xxxl,
  },
  heroImage: {
    width: '100%',
    height: 120,
    borderRadius: 16,
    opacity: 0.25,
  },
  header: {
    gap: Spacing.sm,
    marginBottom: Spacing.xxl,
  },
  form: {
    gap: Spacing.lg,
  },
});
