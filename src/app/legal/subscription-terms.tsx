import { ScrollView, StyleSheet } from 'react-native';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { SUBSCRIPTION_TERMS } from '@/constants/legalContent';
import { Spacing } from '@/constants/theme';

export default function SubscriptionTermsScreen() {
  return (
    <ScreenContainer scroll>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="body">{SUBSCRIPTION_TERMS.replace(/^# .+\n\n/, '')}</AppText>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: Spacing.xxxl,
  },
});
