/**
 * Static wiring checks for voice rate-limit isolation.
 * Runtime JWT keying is covered by backend/src/middleware/security.test.ts.
 *
 * Usage: node scripts/validate-voice-rate-limit.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const checks = [];
function record(name, pass, detail = '') {
  checks.push({ name, pass, detail });
  console.log(`  ${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ` — ${detail}` : ''}`);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

console.log('=== Voice rate-limit isolation ===\n');

const security = read('backend/src/middleware/security.ts');
const index = read('backend/src/index.ts');
const voiceHook = read('src/hooks/useVoiceRecognition.ts');

record('voiceLimiter exported', security.includes('export const voiceLimiter'));
record('separate VOICE_RATE_LIMIT env', security.includes('VOICE_RATE_LIMIT_MAX_PER_MINUTE'));
record('JWT subject helper for /api keys', security.includes('untrustedJwtSubject'));
record('health skipped by global limiter', security.includes("req.path.startsWith('/health')"));
record('health mounted before globalLimiter', /app\.use\('\/health'[\s\S]*app\.use\(globalLimiter\)/.test(index));
record(
  'voice routes use voiceLimiter',
  index.includes("app.use('/api/voice', requireUser, voiceLimiter, voiceRouter)"),
);
record(
  'parse routes use voiceLimiter',
  index.includes("app.use('/api/parse', requireUser, voiceLimiter, parseRouter)"),
);
record('AI routes keep aiLimiter', index.includes("app.use('/api/ai', requireUser, aiLimiter, aiRouter)"));
record(
  'client maps rate-limit errors',
  voiceHook.includes('Voice is busy — wait a few seconds and try again.'),
);
record('backend unit test present', fs.existsSync(path.join(root, 'backend/src/middleware/security.test.ts')));

const pass = checks.filter((c) => c.pass).length;
const total = checks.length;
console.log(`\nSummary: ${pass}/${total} checks`);
if (pass !== total) process.exit(1);
