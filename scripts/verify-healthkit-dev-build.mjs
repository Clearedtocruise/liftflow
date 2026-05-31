#!/usr/bin/env node
/**
 * HealthKit dev-build readiness (static checks — physical device test is manual).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

console.log('=== HealthKit Dev Build Verification ===\n');

const checks = [];
function pass(n) {
  checks.push(1);
  console.log(`  ✓ ${n}`);
}
function fail(n, d = '') {
  checks.push(0);
  console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`);
}

const appConfig = read('app.config.ts');
if (appConfig.includes('@kingstinct/react-native-healthkit')) pass('HealthKit Expo plugin');
else fail('HealthKit Expo plugin');

if (appConfig.includes('NSHealthShareUsageDescription') || appConfig.includes('healthSharePermission')) {
  pass('Health share permission string');
} else fail('Health share permission string');

if (fs.existsSync(path.join(root, 'src/services/healthService.ts'))) pass('healthService.ts');
else fail('healthService.ts');

if (fs.existsSync(path.join(root, 'src/hooks/useHealthSync.ts'))) pass('useHealthSync hook');
else fail('useHealthSync hook');

if (fs.existsSync(path.join(root, 'backend/src/routes/health.ts'))) pass('Backend health routes');
else fail('Backend health routes');

const eas = fs.existsSync(path.join(root, 'eas.json')) ? read('eas.json') : '';
if (eas.includes('production')) pass('EAS production profile');
else fail('EAS production profile');

console.log('\n  Manual (physical iPhone dev client):');
console.log('    • eas build --platform ios --profile development');
console.log('    • Install on device — HealthKit unavailable in Expo Go');
console.log('    • Settings → Health Sync → grant permissions');
console.log('    • Verify HRV/sleep sync on dashboard recovery card');

const failed = checks.filter((c) => !c).length;
console.log(`\n=== HealthKit Static Checks: ${checks.length - failed}/${checks.length} PASS ===`);
process.exit(failed ? 1 : 0);
