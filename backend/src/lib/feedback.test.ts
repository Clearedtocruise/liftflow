import assert from 'node:assert/strict';

import { inferIssueCategory } from './feedback.js';

function run() {
  assert.equal(inferIssueCategory('bug'), 'crash');
  assert.equal(inferIssueCategory('confusion'), 'confusion');
  assert.equal(inferIssueCategory('feature'), 'feature_request');
  assert.equal(inferIssueCategory('feature', 'missing_feature'), 'missing_feature');
  assert.equal(inferIssueCategory('support'), 'support');

  console.log('feedback.test.ts — 5/5 PASS');
}

run();
