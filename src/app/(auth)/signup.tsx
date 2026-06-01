import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AuthFormContainer } from '@/components/auth/AuthFormContainer';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { TextField } from '@/components/layout/TextField';
import { AppText, textStyles } from '@/components/ui/AppText';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { mapAuthError } from '@/lib/authErrors';

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successEmail, setSuccessEmail] = useState<string | null>(null);

  async function handleSignUp() {
    if (loading) return;

    if (!email || !password) {
      setError('Enter your email and password.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const result = await signUp({ email, password, displayName: displayName || undefined });
      if (result.status === 'email_confirmation') {
        setSuccessEmail(result.email);
        return;
      }
      router.replace('/why-liftflow');
    } catch (err) {
      setError(mapAuthError(err, 'signup'));
    } finally {
      setLoading(false);
    }
  }

  if (successEmail) {
    return (
      <AuthFormContainer
        title="Account Created"
        subtitle="Check your email to verify your account before signing in.">
        <View style={styles.successBox}>
          <AppText variant="body" color="textPrimary">
            We sent a verification link to:
          </AppText>
          <AppText variant="bodyBold" color="accent">
            {successEmail}
          </AppText>
          <AppText variant="footnote" color="textSecondary" style={styles.successHint}>
            Open the link on your phone, then return here to log in. If you do not see the email, check spam.
          </AppText>
        </View>
        <PrimaryButton label="Go to Login" onPress={() => router.replace('/(auth)/login')} size="large" />
      </AuthFormContainer>
    );
  }

  return (
    <AuthFormContainer
      title="Create Account"
      subtitle="Start tracking workouts with voice-first logging.">
      <TextField
        label="Display Name"
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Optional"
        autoComplete="name"
        editable={!loading}
      />
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
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="newPassword"
        autoComplete="new-password"
        placeholder="At least 8 characters"
        editable={!loading}
      />

      {error ? (
        <AppText variant="footnote" color="error" style={styles.error}>
          {error}
        </AppText>
      ) : null}

      <AppText variant="caption" color="textTertiary" style={styles.disclaimer}>
        By creating an account, you agree that ONE MORE provides informational coaching only and is not medical advice.
        Exercise at your own risk.
      </AppText>

      <PrimaryButton label="Create Account" onPress={handleSignUp} loading={loading} disabled={loading} size="large" />

      <View style={styles.footer}>
        <AppText variant="footnote" color="textSecondary">
          Already have an account?{' '}
        </AppText>
        <Pressable onPress={() => router.push('/(auth)/login')} disabled={loading}>
          <AppText variant="footnote" style={textStyles.link}>
            Log in
          </AppText>
        </Pressable>
      </View>
    </AuthFormContainer>
  );
}

const styles = StyleSheet.create({
  disclaimer: {
    lineHeight: 18,
  },
  error: {
    lineHeight: 20,
  },
  successBox: {
    gap: Spacing.sm,
  },
  successHint: {
    lineHeight: 18,
    marginTop: Spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
});
