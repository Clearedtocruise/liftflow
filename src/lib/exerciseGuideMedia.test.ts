import assert from 'node:assert/strict';
import test from 'node:test';

import { isUsableTutorialUrl } from './exerciseGuideMedia';

test('a real HTTPS tutorial URL can show a video action', () => {
  assert.equal(isUsableTutorialUrl('https://media.example.com/guides/squat.mp4'), true);
  assert.equal(isUsableTutorialUrl(' https://example.com/watch/squat '), true);
});

test('missing and placeholder media never looks like a video', () => {
  for (const value of [undefined, null, '', ' ', 'coming-soon', 'squat.mp4', '#']) {
    assert.equal(isUsableTutorialUrl(value), false, String(value));
  }
});

test('insecure and non-web schemes are not opened as tutorials', () => {
  assert.equal(isUsableTutorialUrl('http://example.com/squat.mp4'), false);
  assert.equal(isUsableTutorialUrl('file:///tmp/squat.mp4'), false);
  assert.equal(isUsableTutorialUrl('javascript:alert(1)'), false);
});
