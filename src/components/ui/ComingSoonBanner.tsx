import { StyleSheet } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { Spacing } from '@/constants/theme';

export function ComingSoonBanner({ title, description }: { title: string; description: string }) {
  return (
    <Card style={styles.card}>
      <AppText variant="bodyBold" style={styles.centered}>
        {title}
      </AppText>
      <AppText variant="footnote" color="textSecondary" style={styles.centered}>
        {description}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.xs,
    alignItems: 'center',
  },
  centered: {
    textAlign: 'center',
  },
});
