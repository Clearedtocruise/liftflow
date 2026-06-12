import { DEFAULT_UNIT_PREFERENCES } from '@/constants/units';
import { mapAuthError } from '@/lib/authErrors';
import { getEmailConfirmRedirectUrl, getPasswordResetRedirectUrl } from '@/lib/authRedirects';
import { mapProfile } from '@/lib/db-mappers';
import { isSupabaseConfigured, supabase } from '@/supabase/client';
import type { PasswordResetPayload, SignInPayload, SignUpPayload, UserProfile } from '@/types/user';

export type SignUpResult =
  | { status: 'session'; profile: UserProfile }
  | { status: 'email_confirmation'; email: string };

function stubProfileFromAuth(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }): UserProfile {
  return {
    id: user.id,
    email: user.email ?? '',
    displayName: (user.user_metadata?.display_name as string) ?? undefined,
    preferredUnits: 'imperial',
    ...DEFAULT_UNIT_PREFERENCES,
    confirmationMode: 'smart',
    onboardingCompleted: true,
    createdAt: new Date().toISOString(),
  };
}

async function fetchProfile(userId: string, email: string, metadata?: Record<string, unknown>): Promise<UserProfile> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();

  if (error || !data) {
    return {
      id: userId,
      email,
      displayName: (metadata?.display_name as string) ?? undefined,
      preferredUnits: 'imperial',
      ...DEFAULT_UNIT_PREFERENCES,
      confirmationMode: 'smart',
      onboardingCompleted: false,
      createdAt: new Date().toISOString(),
    };
  }

  return mapProfile(data);
}

export const authService = {
  async signUp({ email, password, displayName }: SignUpPayload): Promise<SignUpResult> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured. Add credentials to .env');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: getEmailConfirmRedirectUrl(),
      },
    });

    if (error) {
      throw Object.assign(error, { message: mapAuthError(error, 'signup') });
    }
    if (!data.user) {
      throw new Error(mapAuthError(new Error('Sign up failed'), 'signup'));
    }

    if (!data.session) {
      return { status: 'email_confirmation', email };
    }

    if (displayName) {
      await supabase.from('profiles').update({ display_name: displayName }).eq('id', data.user.id);
    }

    const profile = await fetchProfile(data.user.id, data.user.email ?? email, data.user.user_metadata);
    return { status: 'session', profile };
  },

  async signIn({ email, password }: SignInPayload): Promise<UserProfile> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured. Add credentials to .env');
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw Object.assign(error, { message: mapAuthError(error, 'login') });
    }
    if (!data.user) {
      throw new Error(mapAuthError(new Error('Sign in failed'), 'login'));
    }

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
      redirectTo: getPasswordResetRedirectUrl(),
    });
    if (error) {
      throw Object.assign(error, { message: mapAuthError(error, 'reset') });
    }
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

  async getAuthSessionUser() {
    if (!isSupabaseConfigured) return null;

    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;

    return data.session?.user ?? null;
  },

  stubProfileFromAuth,

  async loadProfile(userId: string, email: string, metadata?: Record<string, unknown>): Promise<UserProfile> {
    return fetchProfile(userId, email, metadata);
  },

  async getSession(): Promise<UserProfile | null> {
    const user = await this.getAuthSessionUser();
    if (!user) return null;

    return fetchProfile(user.id, user.email ?? '', user.user_metadata);
  },

  onAuthStateChange(callback: (profile: UserProfile | null) => void) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') return;

      if (!session?.user) {
        callback(null);
        return;
      }

      const profile = await fetchProfile(session.user.id, session.user.email ?? '', session.user.user_metadata);
      callback(profile);
    });
  },
};
