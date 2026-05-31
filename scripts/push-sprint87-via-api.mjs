#!/usr/bin/env node
/**
 * Push Sprint 8.7 delta to GitHub main (targeted — avoids 537-file full sync).
 * Usage: node scripts/push-sprint87-via-api.mjs
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const OWNER = 'Clearedtocruise';
const REPO = 'liftflow';
const BRANCH = 'main';
const COMMIT_MSG = `Sprint 8.7: closed beta execution tooling

- Beta soak status, retention, launch blockers APIs
- Daily beta report + TestFlight RC preflight scripts
- Internal soak tracker, Wave 1 authorization docs
- validate:sprint87 + beta:daily-report npm scripts`;

const FILES = [
  'backend/src/lib/betaSoak.ts',
  'backend/src/routes/beta.ts',
  'scripts/beta-daily-report.mjs',
  'scripts/build-testflight-rc.mjs',
  'scripts/validate-sprint87-closed-beta.mjs',
  'scripts/push-sprint87-via-api.mjs',
  'package.json',
  'docs/SPRINT87_AUTHORIZATION.md',
  'docs/SPRINT87_INTERNAL_SOAK_TRACKER.md',
  'docs/SPRINT87_WAVE1_AUTHORIZATION.md',
  'docs/SPRINT87_LAUNCH_BLOCKERS.md',
  'docs/SPRINT87_VALIDATION_REPORT.md',
];

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

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function createBlobWithRetry(token, content, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await gh(`/repos/${OWNER}/${REPO}/git/blobs`, token, {
        method: 'POST',
        body: JSON.stringify({ content, encoding: 'base64' }),
      });
    } catch (e) {
      if (attempt === retries) throw e;
      await sleep(2000 * attempt);
    }
  }
}

async function main() {
  const token = getToken();
  console.log('=== Push Sprint 8.7 delta to GitHub main ===\n');

  const missing = FILES.filter((f) => !fs.existsSync(path.join(root, f)));
  if (missing.length) {
    throw new Error(`Missing files: ${missing.join(', ')}`);
  }

  const ref = await gh(`/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`, token);
  const baseSha = ref.object.sha;
  const baseCommit = await gh(`/repos/${OWNER}/${REPO}/git/commits/${baseSha}`, token);
  const baseTree = baseCommit.tree.sha;

  console.log(`Files: ${FILES.length}`);
  const treeEntries = [];
  for (let i = 0; i < FILES.length; i++) {
    const rel = FILES[i];
    process.stdout.write(`  blob ${i + 1}/${FILES.length}: ${rel}\n`);
    const buf = fs.readFileSync(path.join(root, rel));
    const blob = await createBlobWithRetry(token, buf.toString('base64'));
    treeEntries.push({ path: rel, mode: '100644', type: 'blob', sha: blob.sha });
  }

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

  console.log(`\nPushed ${newCommit.sha.slice(0, 7)} to ${BRANCH}`);
  console.log(`https://github.com/${OWNER}/${REPO}/commit/${newCommit.sha}`);
}

main().catch((e) => {
  console.error('PUSH FAILED:', e.message);
  process.exit(1);
});
