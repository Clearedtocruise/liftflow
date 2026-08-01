import assert from 'node:assert/strict';
import test from 'node:test';

import { FALLBACK_RELEASE, formatSentryRelease, normalizeBuildVersion } from './sentryRelease';

test('a build number separates one store build from the next', () => {
  // Every build reported as liftflow@1.0.0, so 344 and 348 were indistinguishable in Sentry.
  assert.equal(formatSentryRelease('liftflow@1.0.0', '348'), 'liftflow@1.0.0+348');
  assert.notEqual(
    formatSentryRelease('liftflow@1.0.0', '347'),
    formatSentryRelease('liftflow@1.0.0', '348'),
  );
});

test('a missing build number falls back to the bare release', () => {
  assert.equal(formatSentryRelease('liftflow@1.0.0', null), 'liftflow@1.0.0');
  assert.equal(formatSentryRelease('liftflow@1.0.0', '  '), 'liftflow@1.0.0');
});

test('a missing release still identifies the app', () => {
  assert.equal(formatSentryRelease(undefined, undefined), FALLBACK_RELEASE);
  assert.equal(formatSentryRelease('', '348'), `${FALLBACK_RELEASE}+348`);
});

test('applying it twice does not stack build numbers', () => {
  const once = formatSentryRelease('liftflow@1.0.0', '348');
  assert.equal(formatSentryRelease(once, '348'), once);
});

test('dist is a trimmed string or nothing at all', () => {
  assert.equal(normalizeBuildVersion(348), '348');
  assert.equal(normalizeBuildVersion(' 348 '), '348');
  assert.equal(normalizeBuildVersion(''), undefined);
  assert.equal(normalizeBuildVersion(null), undefined);
  assert.equal(normalizeBuildVersion(undefined), undefined);
});
