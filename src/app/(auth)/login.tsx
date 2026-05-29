import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AuthFormContainer } from '@/components/auth/AuthFormContainer';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { TextField } from '@/components/layout/TextField';
import { AppText, textStyles } from '@/components/ui/AppText';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      await signIn({ email, password });
      router.replace('/(tabs)/workout');
    } catch {
      Alert.alert('Sign in failed', 'Check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFormContainer
      title="LiftFlow"
      subtitle="Your intelligent workout companion. Log in to continue.">
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
        textContentType="password"
        autoComplete="password"
        placeholder="••••••••"
      />

      <Pressable onPress={() => router.push('/(auth)/forgot-password')} style={styles.forgot}>
        <AppText variant="footnote" style={textStyles.link}>
          Forgot password?
        </AppText>
      </Pressable>

      <PrimaryButton label="Log In" onPress={handleLogin} loading={loading} size="large" />

      <View style={styles.footer}>
        <AppText variant="footnote" color="textSecondary">
          New to LiftFlow?{' '}
        </AppText>
        <Pressable onPress={() => router.push('/(auth)/signup')}>
          <AppText variant="footnote" style={textStyles.link}>
            Create account
          </AppText>
        </Pressable>
      </View>
    </AuthFormContainer>
  );
}

const styles = StyleSheet.create({
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
