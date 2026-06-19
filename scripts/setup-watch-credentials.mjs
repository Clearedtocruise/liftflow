#!/usr/bin/env node
/**
 * One-time setup for Watch TestFlight builds.
 * Run interactively in Terminal (not CI) after accepting Apple Developer PLA.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

console.log('=== ONE MORE Watch credentials ===\n');
console.log('Before running this:');
console.log('1. Sign in at https://developer.apple.com/account');
console.log('2. Accept the latest Program License Agreement (PLA) if prompted');
console.log('3. Run this script from Terminal on your Mac\n');

const result = spawnSync('npx', ['eas-cli', 'credentials:configure-build', '-p', 'ios', '-e', 'testflight'], {
  cwd: root,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
