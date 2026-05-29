import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AuthFormContainer } from '@/components/auth/AuthFormContainer';
import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { Spacing } from '@/constants/theme';

/**
 * Legal onboarding flow — users must accept disclaimers before using LiftFlow.
 * Acceptance records stored in legal_acceptances table (Supabase).
 * MVP: UI scaffold; persistence wired in Phase 1.
 */
export default function LegalOnboardingScreen() {
  return (
    <AuthFormContainer
      title="Before You Start"
      subtitle="Please review and accept the following to use LiftFlow.">
      <Card style={styles.card}>
        <LegalItem
          title="Liability Waiver"
          body="You participate in exercise at your own risk. LiftFlow does not guarantee results."
        />
        <LegalItem
          title="Health Disclaimer"
          body="LiftFlow is informational only. Not medical, physical therapy, or nutritional advice."
        />
        <LegalItem
          title="AI Coaching Disclaimer"
          body="AI recommendations may be inaccurate. Consult a qualified professional before beginning any program."
        />
      </Card>

      <PrimaryButton
        label="I Accept — Continue"
        size="large"
        onPress={() => router.push('/(onboarding)/profile')}
      />
    </AuthFormContainer>
  );
}

function LegalItem({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.legalItem}>
      <AppText variant="callout">{title}</AppText>
      <AppText variant="footnote" color="textSecondary">
        {body}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.lg, marginBottom: Spacing.xl },
  legalItem: { gap: Spacing.xs },
});
