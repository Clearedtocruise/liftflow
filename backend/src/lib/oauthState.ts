import { createHmac, timingSafeEqual } from 'node:crypto';

const STATE_TTL_MS = 10 * 60_000;

export type OAuthState = { userId: string; redirectUri: string };

function stateSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('OAUTH_STATE_SECRET (or SUPABASE_SERVICE_ROLE_KEY) must be set');
  return secret;
}

function sign(payload: string): string {
  return createHmac('sha256', stateSecret()).update(payload).digest('base64url');
}

/** Seals the verified user into the OAuth state so the provider callback can be trusted. */
export function signOAuthState(state: OAuthState): string {
  const payload = Buffer.from(JSON.stringify({ ...state, ts: Date.now() })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifyOAuthState(raw: string): OAuthState | null {
  const [payload, signature] = raw.split('.');
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString()) as OAuthState & { ts?: number };
    if (!decoded.userId || !decoded.ts || Date.now() - decoded.ts > STATE_TTL_MS) return null;
    return { userId: decoded.userId, redirectUri: decoded.redirectUri };
  } catch {
    return null;
  }
}
