import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AuthFormContainer } from '@/components/auth/AuthFormContainer';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { TextField } from '@/components/layout/TextField';
import { AppText } from '@/components/ui/AppText';
import { Spacing } from '@/constants/theme';
import { authService } from '@/services/authService';
import { supabase } from '@/supabase/client';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) setReady(true);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleUpdate() {
    if (loading) return;

    // Validation errors stay next to the fields they refer to; a modal alert made the user
    // dismiss it before they could see which field was wrong.
    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Those passwords don\u2019t match.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await authService.updatePassword(password);
      Alert.alert('Password updated', 'You can now sign in with your new password.', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update your password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFormContainer title="Set New Password" subtitle="Choose a strong password for your account.">
      {!ready ? (
        // Previously a dead end: no reset link in hand meant no way out of this screen.
        <View style={styles.form}>
          <AppText variant="body" color="textSecondary">
            Open the reset link from your email to continue.
          </AppText>
          <PrimaryButton
            label="Back to log in"
            variant="secondary"
            onPress={() => router.replace('/(auth)/login')}
          />
        </View>
      ) : (
        <View style={styles.form}>
          <TextField
            label="New password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            textContentType="newPassword"
            autoComplete="new-password"
            editable={!loading}
            error={error ?? undefined}
          />
          <TextField
            label="Confirm password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
            textContentType="newPassword"
            autoComplete="new-password"
            editable={!loading}
          />
          <PrimaryButton
            label="Update password"
            onPress={handleUpdate}
            loading={loading}
            disabled={loading}
          />
        </View>
      )}
    </AuthFormContainer>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.lg,
  },
});
