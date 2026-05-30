import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { AuthFormContainer } from '@/components/auth/AuthFormContainer';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { TextField } from '@/components/layout/TextField';
import { AppSymbol, SYMBOL_FALLBACKS } from '@/components/ui/AppSymbol';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { mapAuthError } from '@/lib/authErrors';

export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReset() {
    if (loading) return;

    if (!email) {
      setError('Enter the email associated with your account.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await resetPassword({ email });
      setSent(true);
    } catch (err) {
      setError(mapAuthError(err, 'reset'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFormContainer
      title="Reset Password"
      subtitle={
        sent
          ? 'If an account exists, a reset link has been sent to your email.'
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
            editable={!loading}
          />
          {error ? (
            <AppText variant="footnote" color="error">
              {error}
            </AppText>
          ) : null}
          <PrimaryButton
            label="Send Reset Link"
            onPress={handleReset}
            loading={loading}
            disabled={loading}
            size="large"
          />
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
