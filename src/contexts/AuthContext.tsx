import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { authService } from '@/services/authService';
import type { PasswordResetPayload, SignInPayload, SignUpPayload, UserProfile } from '@/types/user';

type AuthContextValue = {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (payload: SignInPayload) => Promise<void>;
  signUp: (payload: SignUpPayload) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (payload: PasswordResetPayload) => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    authService
      .getSession()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));

    const { data: subscription } = authService.onAuthStateChange((profile) => {
      setUser(profile);
      setIsLoading(false);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (payload: SignInPayload) => {
    const profile = await authService.signIn(payload);
    setUser(profile);
  }, []);

  const signUp = useCallback(async (payload: SignUpPayload) => {
    const profile = await authService.signUp(payload);
    setUser(profile);
  }, []);

  const signOut = useCallback(async () => {
    await authService.signOut();
    setUser(null);
  }, []);

  const resetPassword = useCallback(async (payload: PasswordResetPayload) => {
    await authService.resetPassword(payload);
  }, []);

  const refreshProfile = useCallback(async () => {
    const profile = await authService.getSession();
    setUser(profile);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      signIn,
      signUp,
      signOut,
      resetPassword,
      refreshProfile,
    }),
    [user, isLoading, signIn, signUp, signOut, resetPassword, refreshProfile],
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
