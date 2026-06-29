import { Pressable, StyleSheet, View } from 'react-native';

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
      <Card accent style={[styles.card, styles.mediaCard]}>
        <CardLifestyleBanner
          sources={HeroImages.dashboard.checkIn}
          height={80}
          vibrant
          accentLine
          bleed={false}
        />
        <View style={styles.body}>
          <AppText variant="label" color="accent">
            Daily check-in
          </AppText>
          <AppText variant="bodyBold">How are you feeling today?</AppText>
          <AppText variant="footnote" color="textSecondary">
            Sleep, soreness, and energy — your coach uses this to set today&apos;s workout and nutrition.
          </AppText>
          <PrimaryButton label="Check in now" onPress={onPress} size="large" />
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  mediaCard: {
    padding: 0,
    gap: 0,
  },
  body: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
});
