import type { CorsOptions } from 'cors';
import type { Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const DEFAULT_ALLOWED_ORIGINS = [
  'https://liftflow-api.onrender.com',
  'http://localhost:8081',
  'http://localhost:19006',
];

export function allowedOrigins(): string[] {
  const configured = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return configured.length > 0 ? configured : DEFAULT_ALLOWED_ORIGINS;
}

/**
 * Native app requests carry no Origin header and are always allowed; browser origins must be
 * on the ALLOWED_ORIGINS allowlist so a hostile page cannot read API responses cross-origin.
 */
export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins().includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origin not allowed by CORS'));
  },
  credentials: false,
  maxAge: 600,
};

function limitFromEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Read the JWT `sub` without verifying the signature. Used only to pick a rate-limit bucket so
 * authenticated API callers are not all collapsed onto one shared IP (Render's proxy, carrier
 * NAT, etc.). Protected routes still run requireUser and reject forged tokens.
 */
export function untrustedJwtSubject(authorization: string | undefined): string | undefined {
  if (!authorization?.startsWith('Bearer ')) return undefined;
  const token = authorization.slice(7).trim();
  const payload = token.split('.')[1];
  if (!payload) return undefined;
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const json = JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as { sub?: unknown };
    return typeof json.sub === 'string' && json.sub.length > 0 ? json.sub : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Prefer a verified user id, then the JWT subject claim for /api/* traffic, then the client IP.
 * Global middleware runs before requireUser, so without the JWT peek every lifter behind the
 * same NAT/proxy shares one 120/min bucket — which is exactly how voice logging started failing
 * with "Too many requests" while the rest of the app (Supabase) still worked.
 */
export function rateLimitKey(req: Request): string {
  if (req.userId) return `user:${req.userId}`;

  const path = req.originalUrl ?? req.path ?? '';
  if (path.startsWith('/api/')) {
    const subject = untrustedJwtSubject(req.headers.authorization);
    if (subject) return `user:${subject}`;
  }

  return ipKeyGenerator(req.ip ?? '0.0.0.0');
}

/** Broad ceiling on all traffic — blunts enumeration and accidental client retry storms. */
export const globalLimiter = rateLimit({
  windowMs: 60_000,
  limit: limitFromEnv('RATE_LIMIT_MAX_PER_MINUTE', 180),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  // Render's uptime probe must remain responsive even during bursts.
  skip: (req) => req.path.startsWith('/health') || req.originalUrl.startsWith('/health'),
  message: { message: 'Too many requests — slow down', code: 'RATE_LIMITED' },
});

/**
 * Voice set-logging needs several requests per utterance (transcribe, sometimes parse). The
 * shared AI budget of 15/min was small enough that a normal workout with voice + coach TTS
 * burned it mid-session. Voice stays metered, just on its own higher ceiling.
 */
export const voiceLimiter = rateLimit({
  windowMs: 60_000,
  limit: limitFromEnv('VOICE_RATE_LIMIT_MAX_PER_MINUTE', 45),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  message: {
    message: 'Voice is busy — wait a few seconds and try that set again.',
    code: 'VOICE_RATE_LIMITED',
  },
});

/**
 * Tight ceiling on routes that call an LLM provider. Every request here spends real money on
 * the operator's OpenAI key, so this is a denial-of-wallet control, not just an abuse control.
 */
export const aiLimiter = rateLimit({
  windowMs: 60_000,
  limit: limitFromEnv('AI_RATE_LIMIT_MAX_PER_MINUTE', 30),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  message: { message: 'AI request limit reached — try again shortly', code: 'AI_RATE_LIMITED' },
});
