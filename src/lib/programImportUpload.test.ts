import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_IMPORT_PDF_BYTES,
  base64Bytes,
  formatFileSize,
  oversizedPdfMessage,
} from './programImportUpload';

test('an ordinary plan PDF is not objected to', () => {
  assert.equal(oversizedPdfMessage(400_000), null);
  assert.equal(oversizedPdfMessage(MAX_IMPORT_PDF_BYTES), null);
});

test('a file the API would refuse is named and explained before it is sent', () => {
  const message = oversizedPdfMessage(21_000_000);
  assert.ok(message, 'a 21 MB file was allowed through');
  assert.match(message, /21 MB/);
  assert.match(message, /paste the plan text/i);
  // The reader is told what to do, not what HTTP thinks of their file.
  assert.doesNotMatch(message, /entity|payload|body|413/i);
});

test('a size nobody reported is left for the API to judge', () => {
  assert.equal(oversizedPdfMessage(undefined), null);
  assert.equal(oversizedPdfMessage(null), null);
  assert.equal(oversizedPdfMessage(Number.NaN), null);
});

test('the cap leaves room for what base64 adds', () => {
  // The API takes a 12 MB JSON body; four bytes per three is what the file costs inside it.
  assert.ok((MAX_IMPORT_PDF_BYTES * 4) / 3 < 12 * 1024 * 1024);
});

test('a size is read back the way a phone reports it', () => {
  assert.equal(formatFileSize(21_400_000), '21 MB');
  assert.equal(formatFileSize(1_500_000), '1.5 MB');
  assert.equal(formatFileSize(240_000), '240 KB');
});

test('the file behind a base64 payload is measured, not the payload', () => {
  for (const size of [1, 2, 3, 1024, 100_000]) {
    const base64 = Buffer.alloc(size, 7).toString('base64');
    assert.equal(base64Bytes(base64), size, `${size} bytes came back wrong`);
  }
});
