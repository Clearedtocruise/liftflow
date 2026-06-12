import { StyleSheet } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { Spacing } from '@/constants/theme';

export function VoiceComingSoonBanner() {
  return (
    <Card style={styles.card}>
      <AppText variant="bodyBold" style={styles.title}>
        Voice Logging Coming Soon
      </AppText>
      <AppText variant="footnote" color="textSecondary">
        Use manual entry for now. Voice logging will return in a future update.
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
