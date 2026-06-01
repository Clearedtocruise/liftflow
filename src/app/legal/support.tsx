import { ScrollView, StyleSheet } from 'react-native';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { SUPPORT_CONTENT } from '@/constants/legalContent';
import { Spacing } from '@/constants/theme';

export default function SupportScreen() {
  return (
    <ScreenContainer scroll>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="body">{SUPPORT_CONTENT.replace(/^# .+\n\n/, '')}</AppText>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: Spacing.xxxl,
  },
});
