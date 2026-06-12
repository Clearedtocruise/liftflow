import { requireAdmin } from './supabase.js';

export async function redeemBetaInvite(userId: string, code: string) {
  const db = requireAdmin();
  const normalized = code.trim().toUpperCase();

  const { data: invite, error: findErr } = await db
    .from('beta_invites')
    .select('*')
    .eq('code', normalized)
    .maybeSingle();

  if (findErr) throw new Error(findErr.message);
  if (!invite) throw new Error('Invalid invite code');
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) throw new Error('Invite code expired');
  if (invite.uses_count >= invite.max_uses) throw new Error('Invite code fully redeemed');

  const { error: redeemErr } = await db.from('beta_invite_redemptions').insert({
    invite_id: invite.id,
    user_id: userId,
  });

  if (redeemErr && !redeemErr.message.includes('duplicate')) throw new Error(redeemErr.message);

  await db
    .from('beta_invites')
    .update({ uses_count: invite.uses_count + 1 })
    .eq('id', invite.id);

  await db
    .from('profiles')
    .update({
      beta_invite_code: normalized,
      beta_tester_tag: invite.is_internal ? 'internal' : 'beta',
      is_internal_tester: invite.is_internal,
      is_beta_tester: true,
    })
    .eq('id', userId);

  return { code: normalized, isInternal: invite.is_internal, label: invite.label };
}

export async function listReleaseNotes(limit = 10) {
  const db = requireAdmin();
  const { data, error } = await db
    .from('release_notes')
    .select('version, title, body, published_at')
    .eq('is_published', true)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listChangelog(limit = 20) {
  const db = requireAdmin();
  const { data, error } = await db
    .from('changelog_entries')
    .select('version, category, summary, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}
