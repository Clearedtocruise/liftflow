import assert from 'node:assert/strict';
import test from 'node:test';

import { isExemptFromGlobalRateLimit, rateLimitKey, untrustedJwtSubject } from './security.ts';

function bearerForSub(sub: string): string {
  const payload = Buffer.from(JSON.stringify({ sub })).toString('base64url');
  return `Bearer aaa.${payload}.sig`;
}

test('untrustedJwtSubject reads the JWT sub claim', () => {
  assert.equal(untrustedJwtSubject(bearerForSub('user-123')), 'user-123');
  assert.equal(untrustedJwtSubject(undefined), undefined);
  assert.equal(untrustedJwtSubject('Bearer not-a-jwt'), undefined);
});

test('rateLimitKey prefers a verified user id', () => {
  assert.equal(
    rateLimitKey({
      userId: 'verified',
      headers: { authorization: bearerForSub('other') },
      originalUrl: '/api/voice/transcribe',
      ip: '1.2.3.4',
    } as Parameters<typeof rateLimitKey>[0]),
    'user:verified',
  );
});

test('rateLimitKey uses JWT sub for /api traffic before requireUser runs', () => {
  assert.equal(
    rateLimitKey({
      headers: { authorization: bearerForSub('jwt-user') },
      originalUrl: '/api/voice/transcribe',
      ip: '1.2.3.4',
    } as Parameters<typeof rateLimitKey>[0]),
    'user:jwt-user',
  );
});

test('voice routes are outside the shared ceiling so a refetch loop cannot starve a spoken set', () => {
  assert.equal(isExemptFromGlobalRateLimit('/api/voice/transcribe'), true);
  assert.equal(isExemptFromGlobalRateLimit('/api/voice/parse'), true);
  assert.equal(isExemptFromGlobalRateLimit('/api/parse'), true);
  assert.equal(isExemptFromGlobalRateLimit('/health'), true);
  assert.equal(isExemptFromGlobalRateLimit('/api/training/programs/planned'), false);
  assert.equal(isExemptFromGlobalRateLimit('/api/training/recovery/intelligence'), false);
});

test('rateLimitKey ignores JWT sub outside /api so auth routes stay IP-keyed', () => {
  const key = rateLimitKey({
    headers: { authorization: bearerForSub('jwt-user') },
    originalUrl: '/auth/signup',
    ip: '1.2.3.4',
  } as Parameters<typeof rateLimitKey>[0]);
  assert.equal(key.includes('jwt-user'), false);
});
