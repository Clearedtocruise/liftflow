import { ScrollView, StyleSheet } from 'react-native';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { TERMS_OF_SERVICE } from '@/constants/legalContent';
import { Spacing } from '@/constants/theme';

export default function TermsScreen() {
  return (
    <ScreenContainer scroll>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="body">{TERMS_OF_SERVICE.replace(/^# .+\n\n/, '')}</AppText>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: Spacing.xxxl,
  },
});
