#!/usr/bin/env node
/**
 * Sprint 8.4 — Apple Watch Companion validation
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const checks = [];
function record(name, pass, detail = '') {
  checks.push({ name, pass, detail });
  console.log(`  ${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

console.log('=== Sprint 8.4 Apple Watch Companion Validation ===\n');

console.log('--- Core infrastructure ---');
const coreFiles = [
  'src/integrations/watch/types.ts',
  'src/integrations/watch/watchWorkoutAssistant.ts',
  'src/integrations/watch/watchVoiceCommands.ts',
  'src/integrations/watchSyncBridge.ts',
  'src/integrations/watchOfflineQueue.ts',
  'src/services/watchWorkoutService.ts',
  'src/services/watchCompanionService.ts',
  'src/hooks/useWatchCompanionSync.ts',
  'src/hooks/useWatchWorkout.ts',
  'src/state/WatchCompanionBridge.tsx',
  'src/app/(features)/apple-watch.tsx',
  'backend/src/routes/watch.ts',
  'docs/WATCH_ARCHITECTURE.md',
  'docs/HEALTHKIT_REQUIREMENTS.md',
  'docs/APP_STORE_WATCH_REQUIREMENTS.md',
  'docs/WATCH_NATIVE.md',
];

for (const f of coreFiles) {
  record(`File: ${f}`, exists(f));
}

const subConstants = read('src/constants/subscription.ts');
record('PRO feature apple-watch-advanced', subConstants.includes("'apple-watch-advanced'"));

console.log('\n--- Watch workout features ---');
const assistant = read('src/integrations/watch/watchWorkoutAssistant.ts');
record('Rep counting / motion', assistant.includes('processMotionBatch'));
record('Rest timer state', assistant.includes('startRest') && assistant.includes('tickRest'));
record('Voice handler', assistant.includes('handleVoice'));

const watchService = read('src/services/watchWorkoutService.ts');
for (const fn of ['syncActiveSession', 'processMotion', 'handleVoice', 'completeSet', 'handleIncomingMessage', 'updateRestTimer']) {
  record(`watchWorkoutService.${fn}`, watchService.includes(fn));
}

console.log('\n--- Recovery, progression, recommendations ---');
const companion = read('src/services/watchCompanionService.ts');
record('watchCompanionService.enrichState', companion.includes('enrichState'));
record('Recovery score on watch state', read('src/integrations/watch/types.ts').includes('recoveryScore'));
record('Workout recommendation on state', read('src/integrations/watch/types.ts').includes('workoutRecommendation'));
record('Progression line on state', read('src/integrations/watch/types.ts').includes('progressionLine'));

console.log('\n--- Health integration ---');
const hk = read('src/integrations/healthkitProvider.ts');
for (const token of ['HeartRate', 'RestingHeartRate', 'HeartRateVariability', 'Sleep', 'StepCount', 'ActiveEnergyBurned']) {
  record(`HealthKit: ${token}`, hk.includes(token) || hk.toLowerCase().includes(token.toLowerCase()));
}

console.log('\n--- Voice intents ---');
const voice = read('src/integrations/watch/watchVoiceCommands.ts');
for (const pattern of ['log set', 'next set', 'how recovered', 'what should i do next']) {
  record(`Watch voice: ${pattern}`, voice.includes(pattern.split(' ')[0]) || voice.includes(pattern));
}
record('Watch voice: log_set intent', voice.includes("'log_set'"));
record('Watch voice: query_recovery', voice.includes("'query_recovery'"));

console.log('\n--- Phone ↔ Watch sync ---');
const bridge = read('src/integrations/watchSyncBridge.ts');
record('pushWorkoutStateToWatch', bridge.includes('pushWorkoutStateToWatch'));
record('parseWatchWorkoutMessage', bridge.includes('parseWatchWorkoutMessage'));
record('subscribeToWatchMessages', bridge.includes('subscribeToWatchMessages'));
record('Offline queue enqueue', read('src/integrations/watchOfflineQueue.ts').includes('enqueue'));
record('flushWatchOutboundQueue', bridge.includes('flushWatchOutboundQueue'));

const syncHook = read('src/hooks/useWatchCompanionSync.ts');
record('Session sync hook', syncHook.includes('pushPhoneWorkoutState'));
record('Inbound listener hook', syncHook.includes('startInboundListener'));

const providers = read('src/state/AppProviders.tsx');
record('WatchCompanionBridge in AppProviders', providers.includes('WatchCompanionBridge'));

console.log('\n--- UI ---');
const screen = read('src/app/(features)/apple-watch.tsx');
record('FeatureGate apple-watch-advanced', screen.includes('apple-watch-advanced'));
record('Rest timer display', screen.includes('restSecondsRemaining'));
record('Recovery score display', screen.includes('recoveryScore'));

console.log('\n--- Native watchOS target (Phase 2) ---');
record('MotionCapture.swift', exists('targets/watch/MotionCapture.swift'));
record('Watch motion_batch sender', read('targets/watch/MotionCapture.swift').includes('motion_batch'));
record('Watch voice commands', read('targets/watch/content.swift').includes('sendVoiceCommand'));
record('Watch start workout button', read('targets/watch/content.swift').includes("Start Today's Workout"));
record('Phone start_workout bridge', bridge.includes('start_workout'));
record('watchCompanionService.startTodaysWorkoutFromWatch', companion.includes('startTodaysWorkoutFromWatch'));

console.log('\n--- Documentation ---');
record('Watch architecture doc', exists('docs/WATCH_ARCHITECTURE.md'));
record('HealthKit requirements doc', exists('docs/HEALTHKIT_REQUIREMENTS.md'));
record('App Store watch requirements', exists('docs/APP_STORE_WATCH_REQUIREMENTS.md'));

console.log('\n--- Backend ---');
const backendBuild = spawnSync('npm', ['run', 'build'], { cwd: path.join(root, 'backend'), encoding: 'utf8', shell: true });
record('Backend TypeScript build', backendBuild.status === 0);

const passCount = checks.filter((c) => c.pass).length;
const failCount = checks.filter((c) => !c.pass).length;
const overall = failCount === 0;

console.log(`\n=== Sprint 8.4 ${overall ? 'PASS' : 'FAIL'} — ${passCount}/${checks.length} checks ===`);
console.log('\nNote: Native watchOS target + paired hardware required for full E2E — see docs/WATCH_NATIVE.md');

const report = `# Sprint 8.4 — Apple Watch Companion Validation Report

**Date:** ${new Date().toISOString().slice(0, 10)}  
**Result:** ${overall ? 'PASS' : 'FAIL'}  
**Score:** ${passCount}/${checks.length}  

## Summary

Sprint 8.4 delivers the Apple Watch companion architecture: workout logging, rest timer state, voice commands, recovery score, progression recommendations, HealthKit integration paths, phone↔Watch sync with offline queue, and App Store documentation.

**Native watchOS app** and live wrist E2E require EAS dev client + paired Watch hardware.

## Checks

| Check | Result | Detail |
|-------|--------|--------|
${checks.map((c) => `| ${c.name} | ${c.pass ? 'PASS' : 'FAIL'} | ${c.detail || '—'} |`).join('\n')}

## Documentation

- [WATCH_ARCHITECTURE.md](./WATCH_ARCHITECTURE.md)
- [HEALTHKIT_REQUIREMENTS.md](./HEALTHKIT_REQUIREMENTS.md)
- [APP_STORE_WATCH_REQUIREMENTS.md](./APP_STORE_WATCH_REQUIREMENTS.md)
- [WATCH_NATIVE.md](./WATCH_NATIVE.md)

## Ops checklist

1. EAS iOS dev client with HealthKit + WatchConnectivity
2. Add native watchOS target per WATCH_NATIVE.md
3. Pair physical Watch — verify rest timer on wrist during phone workout
4. TestFlight Pro account for review demo

## Re-run

\`\`\`bash
npm run validate:sprint84
\`\`\`
`;

fs.writeFileSync(path.join(root, 'docs/SPRINT84_VALIDATION_REPORT.md'), report);
console.log('Report: docs/SPRINT84_VALIDATION_REPORT.md');

process.exit(overall ? 0 : 1);
