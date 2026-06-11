import { requireAdmin } from './supabase.js';

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

function isPremiumTier(row: { tier?: string; status?: string; current_period_end?: string | null } | null): boolean {
  if (!row || row.tier === 'free') return false;
  if (row.status === 'active' || row.status === 'trialing') return true;
  if (row.status === 'cancelled' && row.current_period_end) {
    return new Date(row.current_period_end) > new Date();
  }
  return false;
}

export async function listBetaManagementUsers(limit = 100): Promise<BetaManagementUser[]> {
  const db = requireAdmin();
  const { data: profiles, error } = await db
    .from('profiles')
    .select('id, email, is_founder, is_beta_tester, is_internal_tester')
    .is('deleted_at', null)
    .order('email')
    .limit(limit);

  if (error) throw new Error(error.message);

  const userIds = (profiles ?? []).map((p) => p.id);
  const { data: subs } = await db
    .from('subscriptions')
    .select('user_id, tier, status, current_period_end')
    .in('user_id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']);

  const subByUser = new Map((subs ?? []).map((s) => [s.user_id, s]));

  return (profiles ?? []).map((p) => {
    const sub = subByUser.get(p.id) ?? null;
    const premium = isPremiumTier(sub) || p.is_founder || p.is_beta_tester || p.is_internal_tester;
    return {
      id: p.id,
      email: p.email,
      isFounder: p.is_founder === true,
      isBetaTester: p.is_beta_tester === true,
      isInternalTester: p.is_internal_tester === true,
      subscriptionTier: sub?.tier ?? 'free',
      subscriptionStatus: sub?.status ?? 'none',
      isPremium: premium,
    };
  });
}

export async function setBetaTesterByEmail(email: string, enabled: boolean): Promise<BetaManagementUser> {
  const db = requireAdmin();
  const normalized = email.trim().toLowerCase();
  const { data: profile, error } = await db
    .from('profiles')
    .select('id, email, is_founder, is_beta_tester, is_internal_tester')
    .ilike('email', normalized)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!profile) throw new Error('User not found');

  if (profile.is_founder && !enabled) {
    throw new Error('Cannot remove beta access from founder account');
  }

  const { error: updateErr } = await db
    .from('profiles')
    .update({
      is_beta_tester: enabled,
      beta_tester_tag: enabled ? 'beta' : null,
    })
    .eq('id', profile.id);

  if (updateErr) throw new Error(updateErr.message);

  const { data: sub } = await db
    .from('subscriptions')
    .select('tier, status, current_period_end')
    .eq('user_id', profile.id)
    .maybeSingle();

  return {
    id: profile.id,
    email: profile.email,
    isFounder: profile.is_founder === true,
    isBetaTester: enabled,
    isInternalTester: profile.is_internal_tester === true,
    subscriptionTier: sub?.tier ?? 'free',
    subscriptionStatus: sub?.status ?? 'none',
    isPremium: isPremiumTier(sub) || profile.is_founder === true || enabled,
  };
}
