import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { LiftFlowLogo } from '@/components/brand/LiftFlowLogo';
import { AppText } from '@/components/ui/AppText';
import { Brand, LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import type { CoachActivationResult } from '@/types/coachActivation';

type OnboardingRevealProps = {
  result: CoachActivationResult | null;
};

/**
 * First win after activation — show the plan they earned, not a generic "you're ready" emoji.
 */
export function OnboardingReveal({ result }: OnboardingRevealProps) {
  const workoutName = result?.programDashboard?.nextWorkout?.name;

  const protein = result?.nutritionGoals?.proteinG;
  const calories = result?.nutritionGoals?.dailyCalories;
  const message = result?.coachMessage?.trim();

  return (
    <View style={styles.root}>
      <Animated.View entering={FadeInUp.duration(420)} style={styles.brand}>
        <LiftFlowLogo size={56} variant="primary" />
        <AppText variant="label" style={styles.brandName}>
          ONE MORE
        </AppText>
        <AppText variant="caption" color="textTertiary" style={styles.tagline}>
          {Brand.taglinePrimary}
        </AppText>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(120).duration(400)} style={styles.headline}>
        <AppText variant="title" align="center">
          Your coach is live.
        </AppText>
        <AppText variant="body" color="textSecondary" align="center">
          Week one is built around you — training, protein, and groceries are ready.
        </AppText>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(220).duration(400)} style={styles.cards}>
        <RevealCard
          label="TODAY'S WORKOUT"
          value={workoutName || 'Your first session'}
          hint="Open Home to start"
        />
        <View style={styles.macroRow}>
          <RevealCard
            label="PROTEIN"
            value={protein != null ? `${protein}g` : '—'}
            hint="Daily target"
            compact
          />
          <RevealCard
            label="CALORIES"
            value={calories != null ? String(calories) : '—'}
            hint="Daily target"
            compact
          />
        </View>
      </Animated.View>

      {message ? (
        <Animated.View entering={FadeInDown.delay(320).duration(400)}>
          <AppText variant="footnote" color="textTertiary" align="center">
            {message}
          </AppText>
        </Animated.View>
      ) : null}
    </View>
  );
}

function RevealCard({
  label,
  value,
  hint,
  compact,
}: {
  label: string;
  value: string;
  hint: string;
  compact?: boolean;
}) {
  return (
    <View style={[styles.cardOuter, compact && styles.cardCompact]}>
      <LinearGradient
        colors={['rgba(14, 144, 255, 0.35)', 'rgba(0, 229, 255, 0.08)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardBorder}>
        <View style={styles.card}>
          <AppText variant="label" color="accent">
            {label}
          </AppText>
          <AppText variant={compact ? 'headline' : 'title'} numberOfLines={2}>
            {value}
          </AppText>
          <AppText variant="caption" color="textTertiary">
            {hint}
          </AppText>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  brand: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  brandName: {
    color: LiftFlowColors.restTimer,
    letterSpacing: 2,
    fontWeight: '700',
  },
  tagline: {
    letterSpacing: 0.4,
  },
  headline: {
    gap: Spacing.sm,
  },
  cards: {
    gap: Spacing.md,
  },
  macroRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  cardOuter: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  cardCompact: {
    flex: 1,
  },
  cardBorder: {
    borderRadius: Radius.lg,
    padding: 1,
  },
  card: {
    gap: Spacing.xs,
    backgroundColor: LiftFlowColors.surface,
    borderRadius: Radius.lg - 1,
    padding: Spacing.lg,
  },
});
