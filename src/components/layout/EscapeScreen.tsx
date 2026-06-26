import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { BrandHeader } from '@/components/brand/BrandHeader';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';

type EscapeScreenProps = {
  title: string;
  message: string;
  primaryLabel?: string;
  onPrimary?: () => void;
};

/** Dead-end recovery — always offers a way back home. */
export function EscapeScreen({
  title,
  message,
  primaryLabel = 'Go to Home',
  onPrimary,
}: EscapeScreenProps) {
  return (
    <View style={styles.root}>
      <BrandHeader subtitle="Something went off-path" compact />
      <AppText variant="headline" align="center">
        {title}
      </AppText>
      <AppText variant="body" color="textSecondary" align="center">
        {message}
      </AppText>
      <PrimaryButton
        label={primaryLabel}
        onPress={onPrimary ?? (() => router.replace('/(tabs)/dashboard'))}
        size="large"
      />
      <PrimaryButton label="Go Back" variant="ghost" onPress={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LiftFlowColors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
});
