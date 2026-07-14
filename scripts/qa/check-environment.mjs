#!/usr/bin/env node
/**
 * Prints ONE MORE QA environment readiness (Part 1).
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function tryRun(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

function hasLine(text, pattern) {
  return text?.split('\n').some((line) => pattern.test(line)) ?? false;
}

const nodeV = tryRun('node -v');
const npmV = tryRun('npm -v');
const expoV = tryRun(`node "${path.join(root, 'node_modules/expo/bin/cli')}" --version`);
const xcodeV = tryRun('xcodebuild -version');
const sims = tryRun('xcrun simctl list devices available');
const booted = tryRun('xcrun simctl list devices booted');
const maestroV = tryRun('maestro --version');

const hasSimulatorDevice =
  hasLine(sims, /iPhone|iPad/) || hasLine(booted, /Booted/);
const canRunExpo = Boolean(nodeV && fs.existsSync(path.join(root, 'node_modules/expo/package.json')));
const canRunMaestro = Boolean(maestroV);

console.log('ONE MORE — QA Environment Check\n');
console.log(`node:              ${nodeV ?? 'NOT FOUND'}`);
console.log(`npm:               ${npmV ?? 'NOT FOUND'}`);
console.log(`expo (local):      ${expoV ?? 'NOT FOUND'}`);
console.log(`xcodebuild:        ${xcodeV?.split('\n')[0] ?? 'NOT FOUND'}`);
console.log(`maestro:           ${maestroV ?? 'NOT INSTALLED'}`);
console.log('');
console.log(`iOS simulator:     ${hasSimulatorDevice ? 'devices listed or booted' : 'none available'}`);
if (sims && !hasSimulatorDevice) {
  console.log('  (simctl available list is empty — install an iOS runtime in Xcode → Settings → Platforms)');
}
console.log('');
console.log('Can run iOS simulator?     ', hasSimulatorDevice ? 'YES' : 'NO');
console.log('Can run Expo locally?      ', canRunExpo ? 'YES' : 'NO');
console.log('Can run Maestro?           ', canRunMaestro ? 'YES' : 'NO');
console.log('');

const missing = [];
if (!hasSimulatorDevice) {
  missing.push('iOS Simulator runtime + device (Xcode → Settings → Platforms → iOS)');
}
if (!canRunMaestro) {
  missing.push('Maestro CLI: curl -Ls "https://get.maestro.mobile.dev" | bash');
}
if (!canRunExpo) {
  missing.push('npm install (Expo dependencies missing)');
}

if (missing.length) {
  console.log('Missing for automated QA on this machine:');
  missing.forEach((item) => console.log(`  • ${item}`));
  console.log('');
  console.log('Fallback: use Settings → QA Checklist (founder account) on a physical device.');
} else {
  console.log('This machine can run Maestro against a booted simulator or connected device.');
  console.log('Prerequisites: dev client or TestFlight build installed; user logged in.');
}
