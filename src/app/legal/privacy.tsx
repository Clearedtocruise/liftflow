import { ScrollView, StyleSheet } from 'react-native';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { PRIVACY_POLICY } from '@/constants/legalContent';
import { Spacing } from '@/constants/theme';

export default function PrivacyPolicyScreen() {
  return (
    <ScreenContainer scroll>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="body">{PRIVACY_POLICY.replace(/^# .+\n\n/, '')}</AppText>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: Spacing.xxxl,
  },
});
