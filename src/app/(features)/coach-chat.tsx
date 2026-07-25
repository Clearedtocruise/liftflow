import { StyleSheet } from 'react-native';

import { ConversationalCoachPanel } from '@/components/coaching/ConversationalCoachPanel';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { FeatureGate } from '@/components/subscription/PremiumGate';
import { AppText } from '@/components/ui/AppText';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

/**
 * Pull-to-refresh used to remount the panel, which threw away the conversation and whatever the
 * user had half-typed. The panel loads its own history, so there is nothing to refresh here.
 */
export default function CoachChatScreen() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <ScreenContainer>
      <AppText variant="body" color="textSecondary" style={styles.subtitle}>
        Ask about training, nutrition, fatigue, plateaus, and progression
      </AppText>

      <FeatureGate featureId="ai-coach">
        <ConversationalCoachPanel context="general" />
      </FeatureGate>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginBottom: Spacing.lg },
});
