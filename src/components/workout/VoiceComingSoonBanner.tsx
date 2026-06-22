import { StyleSheet } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { Spacing } from '@/constants/theme';

export function VoiceComingSoonBanner() {
  return (
    <Card style={styles.card}>
      <AppText variant="bodyBold" style={styles.title}>
        Voice Logging
      </AppText>
      <AppText variant="footnote" color="textSecondary">
        Voice logging is available during an active workout — tap “Tap to Voice Log” or say “Hey OneMore” when enabled in Settings.
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.xs,
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
  },
});
