import { apiClient } from '@/api/client';
import { fail, fromError, ok } from '@/lib/serviceResult';
import { getAccessToken } from '@/supabase/client';

export type BetaManagementUser = {
  id: string;
  email: string;
  isFounder: boolean;
  isBetaTester: boolean;
  isInternalTester: boolean;
  subscriptionTier: string;
  subscriptionStatus: string;
  isPremium: boolean;
};

async function authedPost<T>(path: string, body: unknown) {
  const token = await getAccessToken();
  if (!token) return fail('Not signed in');
  try {
    const data = await apiClient.post<T>(path, body, token);
    return ok(data);
  } catch (e) {
    return fromError(e);
  }
}

async function authedGet<T>(path: string) {
  const token = await getAccessToken();
  if (!token) return fail('Not signed in');
  try {
    const data = await apiClient.get<T>(path, token);
    return ok(data);
  } catch (e) {
    return fromError(e);
  }
}

export const betaManagementService = {
  async listUsers() {
    return authedGet<{ users: BetaManagementUser[] }>('/api/beta/management/users');
  },

  async addBetaTester(email: string) {
    return authedPost<BetaManagementUser>('/api/beta/management/add', { email });
  },

  async removeBetaTester(email: string) {
    return authedPost<BetaManagementUser>('/api/beta/management/remove', { email });
  },
};
