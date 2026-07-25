import { DEFAULT_UNIT_PREFERENCES } from '@/constants/units';
import { mapAuthError } from '@/lib/authErrors';
import { getEmailConfirmRedirectUrl, getPasswordResetRedirectUrl } from '@/lib/authRedirects';
import { mapProfile } from '@/lib/db-mappers';
import { withTimeout } from '@/lib/withTimeout';
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
    // Optimistic: assume the common case (an existing, onboarded user) so the app can render
    // immediately. Callers must not route on this until the real profile has hydrated.
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

  async signInWithPassword({ email, password }: SignInPayload) {
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

    return data.user;
  },

  async signIn({ email, password }: SignInPayload): Promise<UserProfile> {
    const authUser = await this.signInWithPassword({ email, password });
    return withTimeout(
      fetchProfile(authUser.id, authUser.email ?? email, authUser.user_metadata),
      15_000,
      'profile load',
    );
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

  /**
   * `hydrated` is false for the optimistic stub and true once the stored profile has been read,
   * so subscribers can avoid routing on stub-only fields such as `onboardingCompleted`.
   */
  onAuthStateChange(callback: (profile: UserProfile | null, hydrated: boolean) => void) {
    return supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return;

      if (!session?.user) {
        callback(null, true);
        return;
      }

      const authUser = session.user;
      const stub = stubProfileFromAuth(authUser);
      callback(stub, false);

      void withTimeout(
        fetchProfile(authUser.id, authUser.email ?? '', authUser.user_metadata),
        15_000,
        'profile load',
      )
        .then((profile) => callback(profile, true))
        // Never leave the session permanently un-hydrated: fall back to the stub so navigation
        // gated on hydration can proceed rather than hanging on the splash screen.
        .catch(() => callback(stub, true));
    });
  },
};
