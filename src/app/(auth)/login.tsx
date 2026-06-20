import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AuthFormContainer } from '@/components/auth/AuthFormContainer';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { TextField } from '@/components/layout/TextField';
import { AppText, textStyles } from '@/components/ui/AppText';
import { Brand, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { mapAuthError } from '@/lib/authErrors';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const params = useLocalSearchParams<{ verified?: string; authError?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    if (params.verified === '1') {
      setBanner('Email verified. You can now sign in.');
    }
    if (params.authError) {
      setError(String(params.authError));
    }
  }, [params.authError, params.verified]);

  async function handleLogin() {
    if (loading) return;

    if (!email || !password) {
      setError('Enter your email and password.');
      return;
    }

    setError(null);
    setBanner(null);
    setLoading(true);
    try {
      const profile = await signIn({ email, password });
      router.replace(profile.onboardingCompleted ? '/(tabs)/dashboard' : '/(onboarding)/legal');
    } catch (err) {
      setError(mapAuthError(err, 'login'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFormContainer title={Brand.name} subtitle={Brand.taglinePrimary}>
      {banner ? (
        <AppText variant="footnote" color="accent" style={styles.banner}>
          {banner}
        </AppText>
      ) : null}

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
        textContentType="password"
        autoComplete="password"
        placeholder="••••••••"
        editable={!loading}
      />

      {error ? (
        <AppText variant="footnote" color="error" style={styles.error}>
          {error}
        </AppText>
      ) : null}

      <Pressable onPress={() => router.push('/(auth)/forgot-password')} style={styles.forgot} disabled={loading}>
        <AppText variant="footnote" style={textStyles.link}>
          Forgot password?
        </AppText>
      </Pressable>

      <PrimaryButton label="Log In" onPress={handleLogin} loading={loading} disabled={loading} size="large" />

      <View style={styles.footer}>
        <AppText variant="footnote" color="textSecondary">
          New to {Brand.name}?{' '}
        </AppText>
        <Pressable onPress={() => router.push('/(auth)/signup')} disabled={loading}>
          <AppText variant="footnote" style={textStyles.link}>
            Create account
          </AppText>
        </Pressable>
      </View>
    </AuthFormContainer>
  );
}

const styles = StyleSheet.create({
  banner: {
    lineHeight: 20,
  },
  error: {
    lineHeight: 20,
  },
  forgot: {
    alignSelf: 'flex-end',
    marginTop: -Spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
});
