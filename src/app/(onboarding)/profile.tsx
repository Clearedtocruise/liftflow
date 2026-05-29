import { router } from 'expo-router';

import { AuthFormContainer } from '@/components/auth/AuthFormContainer';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { TextField } from '@/components/layout/TextField';
import { AppText } from '@/components/ui/AppText';
import { StyleSheet } from 'react-native';

/**
 * Profile setup onboarding — captures initial user metrics for personalization.
 * Data stored in profiles + user_metrics tables.
 * MVP: UI scaffold; persistence wired in Phase 1.
 */
export default function ProfileOnboardingScreen() {
  return (
    <AuthFormContainer
      title="Your Profile"
      subtitle="Help LiftFlow personalize your training recommendations.">
      <TextField label="Height (cm)" placeholder="175" keyboardType="numeric" />
      <TextField label="Weight (kg)" placeholder="80" keyboardType="numeric" />
      <TextField label="Training Experience" placeholder="beginner / intermediate / advanced" />

      <AppText variant="caption" color="textTertiary" style={styles.note}>
        You can update these anytime in Settings. All fields are optional.
      </AppText>

      <PrimaryButton
        label="Start Training"
        size="large"
        onPress={() => router.replace('/(tabs)/workout')}
      />
    </AuthFormContainer>
  );
}

const styles = StyleSheet.create({
  note: { lineHeight: 18 },
});
