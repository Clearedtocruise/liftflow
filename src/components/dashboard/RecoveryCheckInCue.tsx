import { Pressable, StyleSheet } from 'react-native';

import { Card } from '@/components/layout/Card';
import { CardLifestyleBanner } from '@/components/layout/CardLifestyleBanner';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { HeroImages } from '@/constants/imagery';
import { Spacing } from '@/constants/theme';

type RecoveryCheckInCueProps = {
  onPress: () => void;
};

export function RecoveryCheckInCue({ onPress }: RecoveryCheckInCueProps) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card accent style={styles.card}>
        <CardLifestyleBanner uri={HeroImages.dashboard.checkIn} height={72} />
        <AppText variant="label" color="accent">
          Daily check-in
        </AppText>
        <AppText variant="bodyBold">How are you feeling today?</AppText>
        <AppText variant="footnote" color="textSecondary">
          Sleep, soreness, and energy — your coach uses this to set today&apos;s workout and nutrition.
        </AppText>
        <PrimaryButton label="Check in now" onPress={onPress} size="large" />
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
});
