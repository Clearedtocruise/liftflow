#!/usr/bin/env node
/**
 * Push local changes to GitHub main without local git (Xcode license workaround).
 * Usage: node scripts/push-main-via-api.mjs [--dry-run]
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');

const OWNER = 'Clearedtocruise';
const REPO = 'liftflow';
const BRANCH = 'main';
const COMMIT_MSG = `Sprint 8.6 finalization: Sentry backend + RC validation

- @sentry/node v9 express integration + error handler
- /debug-sentry routes, health sentry status
- verify:sentry script, validate:sprint86 updates`;

const IGNORE = new Set([
  'node_modules',
  '.expo',
  '.git',
  'dist',
  'web-build',
  '.DS_Store',
  'example',
  'ios',
  'android',
]);

const IGNORE_FILES = new Set(['.env', '.env.local', 'expo-env.d.ts', '.expo-tunnel-output.log']);

function shouldInclude(rel) {
  const parts = rel.split('/');
  if (parts.some((p) => IGNORE.has(p))) return false;
  if (IGNORE_FILES.has(path.basename(rel))) return false;
  if (rel.endsWith('.tsbuildinfo')) return false;
  return true;
}

function walk(dir, base = '') {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    if (!shouldInclude(rel)) continue;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) out.push(...walk(full, rel));
    else if (stat.isFile() && stat.size < 50 * 1024 * 1024) out.push(rel);
  }
  return out;
}

function getToken() {
  return execSync('gh auth token', { encoding: 'utf8' }).trim();
}

async function gh(apiPath, token, opts = {}) {
  const res = await fetch(`https://api.github.com${apiPath}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.headers ?? {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) throw new Error(`${res.status} ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  return body;
}

async function main() {
  const token = getToken();
  console.log('=== Push to GitHub main via API ===\n');

  const ref = await gh(`/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`, token);
  const baseSha = ref.object.sha;
  const baseCommit = await gh(`/repos/${OWNER}/${REPO}/git/commits/${baseSha}`, token);
  const baseTree = baseCommit.tree.sha;

  const files = [
    ...walk(root),
    ...['package.json', 'package-lock.json', 'render.yaml', '.env.example', 'app.config.ts', 'eas.json', 'tsconfig.json', 'metro.config.js', 'AGENTS.md', 'CLAUDE.md', 'LICENSE', 'README.md'].filter(
      (f) => fs.existsSync(path.join(root, f)) && shouldInclude(f),
    ),
  ];
  const unique = [...new Set(files)].sort();
  console.log(`Files to sync: ${unique.length}`);

  if (dryRun) {
    unique.slice(0, 20).forEach((f) => console.log(`  ${f}`));
    console.log(`  ... and ${unique.length - 20} more`);
    return;
  }

  const treeEntries = [];
  let i = 0;
  for (const rel of unique) {
    i += 1;
    if (i % 25 === 0) process.stdout.write(`  blobs ${i}/${unique.length}\r`);
    const buf = fs.readFileSync(path.join(root, rel));
    const blob = await gh(`/repos/${OWNER}/${REPO}/git/blobs`, token, {
      method: 'POST',
      body: JSON.stringify({ content: buf.toString('base64'), encoding: 'base64' }),
    });
    treeEntries.push({ path: rel, mode: '100644', type: 'blob', sha: blob.sha });
  }
  console.log(`\nCreated ${treeEntries.length} blobs`);

  const newTree = await gh(`/repos/${OWNER}/${REPO}/git/trees`, token, {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseTree, tree: treeEntries }),
  });

  const newCommit = await gh(`/repos/${OWNER}/${REPO}/git/commits`, token, {
    method: 'POST',
    body: JSON.stringify({
      message: COMMIT_MSG,
      tree: newTree.sha,
      parents: [baseSha],
    }),
  });

  await gh(`/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ sha: newCommit.sha }),
  });

  console.log(`\nPushed commit ${newCommit.sha.slice(0, 7)} to ${BRANCH}`);
  console.log(`https://github.com/${OWNER}/${REPO}/commit/${newCommit.sha}`);
}

main().catch((e) => {
  console.error('PUSH FAILED:', e.message);
  process.exit(1);
});
