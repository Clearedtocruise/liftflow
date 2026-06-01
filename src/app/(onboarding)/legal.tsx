import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AuthFormContainer } from '@/components/auth/AuthFormContainer';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';

const LEGAL_ITEMS = [
  {
    icon: '⚖️',
    title: 'Liability Waiver',
    body: 'You participate in exercise at your own risk. ONE MORE does not guarantee results.',
  },
  {
    icon: '🩺',
    title: 'Health Disclaimer',
    body: 'ONE MORE is informational only. Not medical, physical therapy, or nutritional advice.',
  },
  {
    icon: '🤖',
    title: 'AI Coaching Disclaimer',
    body: 'AI recommendations may be inaccurate. Consult a qualified professional before beginning any program.',
  },
] as const;

export default function LegalOnboardingScreen() {
  return (
    <AuthFormContainer
      title="Before You Start"
      subtitle="Review and accept to unlock your personalized plan.">
      <View style={styles.list}>
        {LEGAL_ITEMS.map((item, i) => (
          <Animated.View key={item.title} entering={FadeInDown.delay(i * 80).duration(400)}>
            <View style={styles.cardOuter}>
              <LinearGradient
                colors={['rgba(31, 107, 255, 0.25)', 'rgba(0, 229, 255, 0.08)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardBorder}>
                <View style={styles.card}>
                  <View style={styles.iconBubble}>
                    <AppText variant="title">{item.icon}</AppText>
                  </View>
                  <View style={styles.cardText}>
                    <AppText variant="callout">{item.title}</AppText>
                    <AppText variant="footnote" color="textSecondary">
                      {item.body}
                    </AppText>
                  </View>
                </View>
              </LinearGradient>
            </View>
          </Animated.View>
        ))}
      </View>

      <PrimaryButton
        label="I Accept — Continue"
        size="large"
        onPress={() => router.push('/(onboarding)/profile')}
      />
    </AuthFormContainer>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  cardOuter: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  cardBorder: {
    borderRadius: Radius.lg,
    padding: 1,
  },
  card: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: LiftFlowColors.surface,
    borderRadius: Radius.lg - 1,
    padding: Spacing.lg,
    alignItems: 'flex-start',
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
    gap: Spacing.xs,
  },
});
