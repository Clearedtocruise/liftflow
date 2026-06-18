import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { Spacing } from '@/constants/theme';

type EmptyStateCardProps = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

type ErrorStateCardProps = {
  title: string;
  message: string;
  onRetry?: () => void;
  onBack?: () => void;
  retryLabel?: string;
  backLabel?: string;
};

export function EmptyStateCard({ title, message, actionLabel, onAction }: EmptyStateCardProps) {
  return (
    <Card style={styles.card}>
      <AppText variant="bodyBold">{title}</AppText>
      <AppText variant="footnote" color="textSecondary">
        {message}
      </AppText>
      {actionLabel && onAction ? (
        <PrimaryButton label={actionLabel} onPress={onAction} variant="secondary" />
      ) : null}
    </Card>
  );
}

export function ErrorStateCard({
  title,
  message,
  onRetry,
  onBack,
  retryLabel = 'Try again',
  backLabel = 'Go back',
}: ErrorStateCardProps) {
  return (
    <Card style={styles.card}>
      <AppText variant="bodyBold">{title}</AppText>
      <AppText variant="footnote" color="textSecondary">
        {message}
      </AppText>
      <View style={styles.actions}>
        {onRetry ? <PrimaryButton label={retryLabel} onPress={onRetry} /> : null}
        {onBack ? <PrimaryButton label={backLabel} onPress={onBack} variant="secondary" /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  actions: {
    gap: Spacing.sm,
  },
});
