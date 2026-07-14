#!/usr/bin/env node
/**
 * Runs a Maestro flow with clear errors when tooling is missing.
 * Usage: node scripts/qa/run-maestro.mjs smoke.yaml
 */
import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const flowArg = process.argv[2];

if (!flowArg) {
  console.error('Usage: node scripts/qa/run-maestro.mjs <flow-file.yaml>');
  process.exit(1);
}

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

const maestro = run('which maestro');
if (!maestro) {
  console.error('\nONE MORE QA — Maestro is not installed.\n');
  console.error('Install: curl -Ls "https://get.maestro.mobile.dev" | bash');
  console.error('Then re-run: npm run qa:smoke\n');
  console.error('Fallback: Settings → QA Checklist on your founder account (physical device).\n');
  process.exit(1);
}

const sims = run('xcrun simctl list devices available');
const booted = run('xcrun simctl list devices booted');
const hasSimulator = /iPhone|iPad/.test(sims ?? '') || /Booted/.test(booted ?? '');

if (!hasSimulator) {
  console.warn('\nONE MORE QA — No iOS simulator detected.');
  console.warn('Maestro will run against a USB-connected iPhone if one is installed and unlocked.');
  console.warn('Install a simulator: Xcode → Settings → Platforms → iOS\n');
}

const flowPath = path.isAbsolute(flowArg) ? flowArg : path.join(root, '.maestro', flowArg);
if (!fs.existsSync(flowPath)) {
  console.error(`Flow not found: ${flowPath}`);
  process.exit(1);
}

console.log(`\nRunning Maestro: ${path.basename(flowPath)}\n`);
const result = spawnSync('maestro', ['test', flowPath], { stdio: 'inherit', cwd: root });
process.exit(result.status ?? 1);
