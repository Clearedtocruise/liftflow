import * as Linking from 'expo-linking';

import { mapProfile } from '@/lib/db-mappers';
import { isSupabaseConfigured, supabase } from '@/supabase/client';
import type { PasswordResetPayload, SignInPayload, SignUpPayload, UserProfile } from '@/types/user';

const PASSWORD_RESET_REDIRECT = Linking.createURL('reset-password');

async function fetchProfile(userId: string, email: string, metadata?: Record<string, unknown>): Promise<UserProfile> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();

  if (error || !data) {
    return {
      id: userId,
      email,
      displayName: (metadata?.display_name as string) ?? undefined,
      preferredUnits: 'imperial',
      confirmationMode: 'smart',
      onboardingCompleted: false,
      createdAt: new Date().toISOString(),
    };
  }

  return mapProfile(data);
}

export const authService = {
  async signUp({ email, password, displayName }: SignUpPayload): Promise<UserProfile> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured. Add credentials to .env');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });

    if (error) throw error;
    if (!data.user) throw new Error('Sign up failed');

    if (!data.session) {
      throw new Error(
        'Account created. Check your email to confirm, or disable email confirmation in Supabase Auth settings for testing.',
      );
    }

    if (displayName) {
      await supabase.from('profiles').update({ display_name: displayName }).eq('id', data.user.id);
    }

    return fetchProfile(data.user.id, data.user.email ?? email, data.user.user_metadata);
  },

  async signIn({ email, password }: SignInPayload): Promise<UserProfile> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured. Add credentials to .env');
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error('Sign in failed');

    return fetchProfile(data.user.id, data.user.email ?? email, data.user.user_metadata);
  },

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async resetPassword({ email }: PasswordResetPayload): Promise<void> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured. Add credentials to .env');
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: PASSWORD_RESET_REDIRECT,
    });
    if (error) throw error;
  },

  async updatePassword(newPassword: string): Promise<void> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured. Add credentials to .env');
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  async deleteAccount(): Promise<void> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured. Add credentials to .env');
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) throw new Error('Not signed in');

    // Soft-delete profile marker before auth deletion
    await supabase.from('profiles').update({ deleted_at: new Date().toISOString() }).eq('id', userId);

    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const response = await fetch(
      `${process.env.EXPO_PUBLIC_API_URL ?? 'https://liftflow-api.onrender.com'}/api/user/account`,
      {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    );

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(body.message ?? 'Account deletion failed');
    }

    await supabase.auth.signOut();
  },

  async getSession(): Promise<UserProfile | null> {
    if (!isSupabaseConfigured) return null;

    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;

    const user = data.session?.user;
    if (!user) return null;

    return fetchProfile(user.id, user.email ?? '', user.user_metadata);
  },

  onAuthStateChange(callback: (profile: UserProfile | null) => void) {
    return supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
        callback(null);
        return;
      }
      const profile = await fetchProfile(session.user.id, session.user.email ?? '', session.user.user_metadata);
      callback(profile);
    });
  },
};
