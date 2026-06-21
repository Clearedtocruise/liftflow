import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useAuthDeepLink } from '@/hooks/useAuthDeepLink';
import { startPlanPrefetch } from '@/lib/planDataPrefetch';
import { logStartup } from '@/lib/startupLogger';
import { withTimeout } from '@/lib/withTimeout';
import { authService, type SignUpResult } from '@/services/authService';
import type { PasswordResetPayload, SignInPayload, SignUpPayload, UserProfile } from '@/types/user';

type AuthContextValue = {
  user: UserProfile | null;
  isLoading: boolean;
  isProfileReady: boolean;
  isAuthenticated: boolean;
  signIn: (payload: SignInPayload) => Promise<UserProfile>;
  signUp: (payload: SignUpPayload) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  resetPassword: (payload: PasswordResetPayload) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileReady, setIsProfileReady] = useState(false);

  useAuthDeepLink();

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const authUser = await withTimeout(authService.getAuthSessionUser(), 10_000, 'auth session');
        if (cancelled) return;

        if (!authUser) {
          setUser(null);
          setIsProfileReady(true);
          logStartup('AUTH_READY', { authenticated: false });
          return;
        }

        const stub = authService.stubProfileFromAuth(authUser);
        setUser(stub);
        setIsProfileReady(true);
        logStartup('AUTH_READY', { authenticated: true });
        logStartup('PROFILE_READY', { source: 'stub' });
        setIsLoading(false);

        startPlanPrefetch(authUser.id, stub.timezone);

        const profile = await authService.loadProfile(
          authUser.id,
          authUser.email ?? '',
          authUser.user_metadata,
        );
        if (cancelled) return;

        setUser(profile);
        logStartup('PROFILE_LOADED');
      } catch {
        if (!cancelled) {
          setUser(null);
          setIsProfileReady(true);
          logStartup('AUTH_READY', { authenticated: false });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    const { data: subscription } = authService.onAuthStateChange((profile) => {
      setUser(profile);
      setIsProfileReady(true);
      if (profile) {
        logStartup('PROFILE_LOADED');
        logStartup('PROFILE_READY');
      }
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (payload: SignInPayload) => {
    const authUser = await authService.signInWithPassword(payload);
    const stub = authService.stubProfileFromAuth(authUser);
    setUser(stub);
    setIsProfileReady(true);
    startPlanPrefetch(authUser.id, stub.timezone);

    void authService
      .loadProfile(authUser.id, authUser.email ?? payload.email, authUser.user_metadata)
      .then((profile) => {
        setUser(profile);
        logStartup('PROFILE_LOADED');
      })
      .catch((error) => {
        console.warn('[auth] profile load after sign-in failed', error);
      });

    return stub;
  }, []);

  const signUp = useCallback(async (payload: SignUpPayload) => {
    const result = await authService.signUp(payload);
    if (result.status === 'session') {
      setUser(result.profile);
      setIsProfileReady(true);
      startPlanPrefetch(result.profile.id, result.profile.timezone);
    }
    return result;
  }, []);

  const signOut = useCallback(async () => {
    await authService.signOut();
    setUser(null);
    setIsProfileReady(true);
  }, []);

  const resetPassword = useCallback(async (payload: PasswordResetPayload) => {
    await authService.resetPassword(payload);
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    await authService.updatePassword(password);
  }, []);

  const deleteAccount = useCallback(async () => {
    await authService.deleteAccount();
    setUser(null);
    setIsProfileReady(true);
  }, []);

  const refreshProfile = useCallback(async () => {
    const profile = await authService.getSession();
    setUser(profile);
    setIsProfileReady(true);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isProfileReady,
      isAuthenticated: Boolean(user),
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
      deleteAccount,
      refreshProfile,
    }),
    [
      user,
      isLoading,
      isProfileReady,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
      deleteAccount,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
