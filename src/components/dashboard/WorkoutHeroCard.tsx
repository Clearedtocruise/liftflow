import type { ImageSource } from 'expo-image';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { HeroImages } from '@/constants/imagery';
import { LiftFlowColors, Radius, Shadows, Spacing } from '@/constants/theme';

type WorkoutHeroCardProps = {
  title: string;
  durationMin?: number;
  subtitle?: string;
  onStart: () => void;
  loading?: boolean;
  imageSources?: readonly ImageSource[];
};

export function WorkoutHeroCard({
  title,
  durationMin,
  subtitle,
  onStart,
  loading,
  imageSources = HeroImages.dashboard.cardWorkout,
}: WorkoutHeroCardProps) {
  return (
    <View style={styles.outer}>
      <LinearGradient
        colors={['rgba(31, 107, 255, 0.25)', 'rgba(0, 229, 255, 0.08)']}
        style={styles.border}>
        <View style={styles.card}>
          <View style={styles.heroWrap}>
            <Image source={imageSources[0]} style={styles.hero} contentFit="cover" />
            <LinearGradient colors={['transparent', LiftFlowColors.surface]} style={styles.fade} />
            <View style={styles.heroBadge}>
              <AppText variant="label" color="textPrimary">
                Today&apos;s Workout
              </AppText>
            </View>
          </View>
          <View style={styles.body}>
            <AppText variant="headline">{title}</AppText>
            <AppText variant="footnote" color="textSecondary">
              {durationMin ? `${durationMin} min` : 'Scheduled'}
              {subtitle ? ` · ${subtitle}` : ''}
            </AppText>
            <PrimaryButton label="START WORKOUT" onPress={onStart} loading={loading} size="large" />
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    marginBottom: Spacing.lg,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadows.glow,
  },
  border: {
    borderRadius: Radius.xl,
    padding: 1,
  },
  card: {
    borderRadius: Radius.xl - 1,
    overflow: 'hidden',
    backgroundColor: LiftFlowColors.surface,
  },
  heroWrap: {
    height: 168,
  },
  hero: {
    width: '100%',
    height: '100%',
  },
  fade: {
    ...StyleSheet.absoluteFillObject,
  },
  heroBadge: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    backgroundColor: LiftFlowColors.glass,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  body: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
});
