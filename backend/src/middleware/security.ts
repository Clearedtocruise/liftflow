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

/** Rate-limit bucket: the verified user when known, otherwise the client IP. */
function userOrIpKey(req: Request): string {
  return req.userId ?? ipKeyGenerator(req.ip ?? '');
}

/** Broad ceiling on all traffic — blunts enumeration and accidental client retry storms. */
export const globalLimiter = rateLimit({
  windowMs: 60_000,
  limit: limitFromEnv('RATE_LIMIT_MAX_PER_MINUTE', 120),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  // Render's uptime probe must remain responsive even during bursts.
  skip: (req) => req.path.startsWith('/health') || req.originalUrl.startsWith('/health'),
  message: { message: 'Too many requests — slow down', code: 'RATE_LIMITED' },
});

/**
 * Tight ceiling on routes that call an LLM provider. Every request here spends real money on
 * the operator's OpenAI key, so this is a denial-of-wallet control, not just an abuse control.
 */
export const aiLimiter = rateLimit({
  windowMs: 60_000,
  limit: limitFromEnv('AI_RATE_LIMIT_MAX_PER_MINUTE', 15),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: { message: 'AI request limit reached — try again shortly', code: 'AI_RATE_LIMITED' },
});
