#!/usr/bin/env node
/**
 * Validates Month 1 reference program data (24 workouts, volume, supersets).
 * Run: npm run validate:month1-reference
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const backend = path.join(root, 'backend');

const result = spawnSync(
  process.execPath,
  ['./node_modules/tsx/dist/cli.mjs', '--test', 'src/lib/liftingReference/month1Reference.test.ts'],
  { cwd: backend, stdio: 'inherit', env: process.env },
);

if (result.status !== 0) {
  console.error('\nMonth 1 reference validation FAILED');
  process.exit(result.status ?? 1);
}

console.log('\nMonth 1 reference validation PASSED');
