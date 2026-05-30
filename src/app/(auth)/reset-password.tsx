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
    if (password.length < 8) {
      Alert.alert('Password too short', 'Use at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await authService.updatePassword(password);
      Alert.alert('Password updated', 'You can now sign in with your new password.', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not update password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFormContainer title="Set New Password" subtitle="Choose a strong password for your account.">
      {!ready ? (
        <AppText variant="body" color="textSecondary">
          Open the reset link from your email to continue.
        </AppText>
      ) : (
        <View style={styles.form}>
          <TextField label="New password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
          <TextField label="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" />
          <PrimaryButton label={loading ? 'Saving…' : 'Update Password'} onPress={handleUpdate} disabled={loading} />
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
