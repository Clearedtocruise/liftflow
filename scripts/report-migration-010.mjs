#!/usr/bin/env node
/**
 * Migration 010 validation report
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

console.log('=== Migration 010 Validation Report ===\n');

const diag = spawnSync('node', ['scripts/diagnose-migration-010.mjs'], { cwd: root, encoding: 'utf8' });
process.stdout.write(diag.stdout ?? '');

const verify = spawnSync('node', ['scripts/verify-gym-types.mjs'], { cwd: root, encoding: 'utf8' });
process.stdout.write('\n');
process.stdout.write(verify.stdout ?? '');

const pass = verify.status === 0;
const reportPath = path.join(root, 'docs/MIGRATION_010_VERIFICATION_REPORT.md');
const gymTypes = ['home_gym', 'commercial_gym', 'garage_gym', 'planet_fitness', 'full_gym'];
fs.writeFileSync(
  reportPath,
  `# Migration 010 Verification Report

**Date:** ${new Date().toISOString().slice(0, 10)}  
**Status:** ${pass ? 'PASS' : 'FAIL'}  
**Gym types:** ${pass ? '5/5' : 'see verify-gym-types output'}

## Root cause (when failing)

Migration 010 DDL was not applied. Production still uses Migration 003 constraint:
\`training_location IN ('home_gym', 'commercial_gym')\`.

## Required types

${gymTypes.map((t) => `- ${t}`).join('\n')}

## Apply

\`\`\`bash
npm run diagnose:migration010
npm run migrate:010
npm run verify:gym-types
\`\`\`
`,
);

console.log(`\nReport: docs/MIGRATION_010_VERIFICATION_REPORT.md`);
process.exit(pass ? 0 : 1);
