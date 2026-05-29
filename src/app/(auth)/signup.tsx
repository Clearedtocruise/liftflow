import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AuthFormContainer } from '@/components/auth/AuthFormContainer';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { TextField } from '@/components/layout/TextField';
import { AppText, textStyles } from '@/components/ui/AppText';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      await signUp({ email, password, displayName: displayName || undefined });
      router.replace('/(tabs)/workout');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not create your account. Try again.';
      Alert.alert('Sign up failed', message);
    } finally {
      setLoading(false);
    }
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
      />
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        placeholder="you@example.com"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="newPassword"
        autoComplete="new-password"
        placeholder="At least 8 characters"
      />

      <AppText variant="caption" color="textTertiary" style={styles.disclaimer}>
        By creating an account, you agree that LiftFlow provides informational coaching only
        and is not medical advice. Exercise at your own risk.
      </AppText>

      <PrimaryButton label="Create Account" onPress={handleSignUp} loading={loading} size="large" />

      <View style={styles.footer}>
        <AppText variant="footnote" color="textSecondary">
          Already have an account?{' '}
        </AppText>
        <Pressable onPress={() => router.push('/(auth)/login')}>
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
});
