import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';

import { AuthFormContainer } from '@/components/auth/AuthFormContainer';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { TextField } from '@/components/layout/TextField';
import { AppSymbol, SYMBOL_FALLBACKS } from '@/components/ui/AppSymbol';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleReset() {
    if (!email) {
      Alert.alert('Email required', 'Enter the email associated with your account.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword({ email });
      setSent(true);
    } catch {
      Alert.alert('Reset failed', 'Could not send reset email. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFormContainer
      title="Reset Password"
      subtitle={
        sent
          ? 'If an account exists, a reset link has been sent.'
          : 'Enter your email and we will send a reset link.'
      }>
      <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button">
        <AppSymbol
          name="chevron.left"
          fallback={SYMBOL_FALLBACKS['chevron.left']}
          size={18}
          tintColor={LiftFlowColors.accent}
        />
        <AppText variant="callout" color="accent">
          Back
        </AppText>
      </Pressable>

      {!sent ? (
        <>
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            placeholder="you@example.com"
          />
          <PrimaryButton label="Send Reset Link" onPress={handleReset} loading={loading} size="large" />
        </>
      ) : (
        <PrimaryButton label="Return to Login" onPress={() => router.replace('/(auth)/login')} size="large" />
      )}
    </AuthFormContainer>
  );
}

const styles = StyleSheet.create({
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
    alignSelf: 'flex-start',
  },
});
