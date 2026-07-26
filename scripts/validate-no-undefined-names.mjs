#!/usr/bin/env node
/**
 * Fails on TypeScript "Cannot find name" errors specifically.
 *
 * The repo carries a long-standing typecheck backlog that is treated as a known baseline, and the
 * handoff notes tell each new agent not to chase it. That is reasonable for the interface-drift and
 * enum-widening errors in there — but TS2304 is not that kind of error. A name that does not resolve
 * is a guaranteed ReferenceError the moment the line runs, and three of them were sitting in the
 * baseline breaking the whole Tabata section of Settings.
 *
 * TS2552 ("did you mean") and TS2686 (UMD global) are the same fault under different codes.
 *
 * Usage: npm run validate:no-undefined-names
 */
import { spawnSync } from 'node:child_process';

const FATAL = /error (TS2304|TS2552|TS2686):/;

const result = spawnSync('node', ['./node_modules/typescript/bin/tsc', '--noEmit'], {
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
});

const lines = `${result.stdout ?? ''}${result.stderr ?? ''}`.split('\n');
const offenders = lines.filter((line) => FATAL.test(line));
const total = lines.filter((line) => /error TS\d+:/.test(line)).length;

console.log(`\ntypecheck errors in total: ${total}`);
console.log(`of those, unresolved names: ${offenders.length}`);

if (offenders.length > 0) {
  console.log('\nEach of these throws a ReferenceError when the line executes:\n');
  for (const line of offenders) console.log(`  ${line.trim()}`);
  console.log('\nUnresolved names: FAIL');
  process.exit(1);
}

console.log('\nUnresolved names: PASS');
