import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AuthFormContainer } from '@/components/auth/AuthFormContainer';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText, textStyles } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing, TouchTarget } from '@/constants/theme';

const LEGAL_ITEMS = [
  {
    title: 'Liability Waiver',
    body: 'You participate in exercise at your own risk. ONE MORE does not guarantee results.',
  },
  {
    title: 'Health Disclaimer',
    body: 'ONE MORE is informational only. Not medical, physical therapy, or nutritional advice.',
  },
  {
    title: 'AI Coaching Disclaimer',
    body: 'AI recommendations may be inaccurate. Consult a qualified professional before beginning any program.',
  },
] as const;

export default function LegalOnboardingScreen() {
  const [accepted, setAccepted] = useState(false);

  return (
    <AuthFormContainer
      title="Before you train"
      subtitle="A quick read so we coach you safely. Full documents are always a tap away.">
      <View style={styles.list}>
        {LEGAL_ITEMS.map((item, i) => (
          <Animated.View key={item.title} entering={FadeInDown.delay(i * 70).duration(380)}>
            <View style={styles.item}>
              <View style={styles.indexMark}>
                <AppText variant="caption" color="accent">
                  {String(i + 1).padStart(2, '0')}
                </AppText>
              </View>
              <View style={styles.itemText}>
                <AppText variant="callout">{item.title}</AppText>
                <AppText variant="footnote" color="textSecondary">
                  {item.body}
                </AppText>
              </View>
            </View>
          </Animated.View>
        ))}
      </View>

      <View style={styles.links}>
        <Pressable
          onPress={() => router.push('/legal/terms')}
          style={styles.link}
          accessibilityRole="button"
          accessibilityLabel="Read the Terms of Service">
          <AppText variant="footnote" style={textStyles.link}>
            Terms of Service
          </AppText>
        </Pressable>
        <Pressable
          onPress={() => router.push('/legal/privacy')}
          style={styles.link}
          accessibilityRole="button"
          accessibilityLabel="Read the Privacy Policy">
          <AppText variant="footnote" style={textStyles.link}>
            Privacy Policy
          </AppText>
        </Pressable>
      </View>

      <Pressable
        onPress={() => setAccepted((v) => !v)}
        style={styles.acceptRow}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: accepted }}
        accessibilityLabel="I have read and accept the disclaimers">
        <View style={[styles.checkbox, accepted && styles.checkboxOn]}>
          {accepted ? (
            <LinearGradient
              colors={[LiftFlowColors.primary, LiftFlowColors.gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.checkboxFill}
            />
          ) : null}
        </View>
        <AppText variant="subhead" color="textSecondary" style={styles.acceptCopy}>
          I have read and accept these terms
        </AppText>
      </Pressable>

      <PrimaryButton
        label="Continue to setup"
        size="large"
        disabled={!accepted}
        onPress={() => router.push('/(onboarding)/profile')}
      />
    </AuthFormContainer>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  item: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  indexMark: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.surfaceElevated,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    flex: 1,
    gap: Spacing.xs,
    paddingTop: 2,
  },
  links: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  link: {
    minHeight: TouchTarget.min,
    justifyContent: 'center',
  },
  acceptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: TouchTarget.min,
    marginBottom: Spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: LiftFlowColors.border,
    backgroundColor: LiftFlowColors.surfaceElevated,
    overflow: 'hidden',
  },
  checkboxOn: {
    borderColor: LiftFlowColors.primary,
  },
  checkboxFill: {
    flex: 1,
  },
  acceptCopy: {
    flex: 1,
  },
});
