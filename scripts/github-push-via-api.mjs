#!/usr/bin/env node
/**
 * Push local workspace to GitHub main via Git Data API (when local git is unavailable).
 * Usage: node scripts/github-push-via-api.mjs [--dry-run]
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');
const owner = 'Clearedtocruise';
const repo = 'liftflow';
const branch = 'main';

const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'backend/node_modules',
  '.expo',
  'dist',
  'backend/dist',
  '.cursor',
  'terminals',
]);
const SKIP_FILES = new Set(['.env', 'expo-go-qr.png']);

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    const rel = path.relative(root, full).replace(/\\/g, '/');
    if (SKIP_FILES.has(name) || rel.endsWith('.env')) continue;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else if (stat.isFile() && stat.size < 5_000_000) files.push(rel);
  }
  return files;
}

async function gh(path, opts = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${process.env.GH_TOKEN || process.env.GITHUB_TOKEN || ''}`,
      ...(opts.headers || {}),
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) throw new Error(`${res.status} ${path}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  return body;
}

async function getGhToken() {
  const { execSync } = await import('child_process');
  try {
    return execSync('gh auth token', { encoding: 'utf8' }).trim();
  } catch {
    throw new Error('Run gh auth login first');
  }
}

async function main() {
  process.env.GH_TOKEN = await getGhToken();

  const ref = await gh(`/repos/${owner}/${repo}/git/ref/heads/${branch}`);
  const baseCommitSha = ref.object.sha;
  const baseCommit = await gh(`/repos/${owner}/${repo}/git/commits/${baseCommitSha}`);
  const baseTreeSha = baseCommit.tree.sha;

  const remoteTree = await gh(
    `/repos/${owner}/${repo}/git/trees/${baseTreeSha}?recursive=1`,
  );
  const remoteMap = new Map(
    (remoteTree.tree || [])
      .filter((t) => t.type === 'blob')
      .map((t) => [t.path, t.sha]),
  );

  const localFiles = walk(root).sort();
  const toUpdate = [];

  for (const rel of localFiles) {
    const content = fs.readFileSync(path.join(root, rel));
    const localSha = crypto.createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex');
    const remoteSha = remoteMap.get(rel);
    if (remoteSha !== localSha) {
      toUpdate.push({ path: rel, content: content.toString('base64'), encoding: 'base64' });
    }
  }

  console.log(`Base commit: ${baseCommitSha.slice(0, 12)}`);
  console.log(`Local files scanned: ${localFiles.length}`);
  console.log(`Files to update: ${toUpdate.length}`);

  if (dryRun) {
    toUpdate.slice(0, 50).forEach((f) => console.log('  update:', f.path));
    if (toUpdate.length > 50) console.log(`  ... and ${toUpdate.length - 50} more`);
    return;
  }

  if (toUpdate.length === 0) {
    console.log('Nothing to push.');
    return;
  }

  // GitHub tree API limit — batch in chunks of 100
  const treeEntries = [];
  for (let i = 0; i < toUpdate.length; i++) {
    const f = toUpdate[i];
    const blob = await gh(`/repos/${owner}/${repo}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: f.content, encoding: 'base64' }),
    });
    treeEntries.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
    if ((i + 1) % 20 === 0) console.log(`  blobs ${i + 1}/${toUpdate.length}`);
  }

  const tree = await gh(`/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries }),
  });

  const commit = await gh(`/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({
      message: 'Deploy Sprint 2–3 coaching ecosystem and Sprint 3.5 integration fixes to production.\n\nIncludes program engine, recovery/limitations/nutrition API routes, program loop wiring, location-aware programming, and deployment verification scripts.',
      tree: tree.sha,
      parents: [baseCommitSha],
    }),
  });

  await gh(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });

  console.log('Pushed commit:', commit.sha);
  console.log(`https://github.com/${owner}/${repo}/commit/${commit.sha}`);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
