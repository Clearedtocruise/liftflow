import { StyleSheet } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { VoiceComingSoonBanner } from '@/components/workout/VoiceComingSoonBanner';
import { Spacing } from '@/constants/theme';

export function VoiceCoachPanel() {
  return (
    <Card style={styles.card}>
      <AppText variant="headline">Voice Coach</AppText>
      <AppText variant="body" color="textSecondary">
        Ask coaching questions with text input elsewhere in the app for now.
      </AppText>

      <VoiceComingSoonBanner />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
});
