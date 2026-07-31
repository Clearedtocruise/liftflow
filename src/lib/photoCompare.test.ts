import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clampPan,
  clampZoom,
  DOUBLE_TAP_ZOOM,
  MAX_SPLIT,
  MAX_ZOOM,
  maxPanOffset,
  MIN_SPLIT,
  MIN_ZOOM,
  nextDoubleTapZoom,
  splitFromTouch,
} from './photoCompare';

test('split tracks the finger relative to the frame, not the screen', () => {
  // Frame starts 40px in from the screen edge and is 200px wide.
  assert.equal(splitFromTouch(140, 40, 200), 0.5);
  assert.equal(splitFromTouch(40, 40, 200), MIN_SPLIT);
  assert.equal(splitFromTouch(240, 40, 200), MAX_SPLIT);
});

test('split stays usable before layout reports a width', () => {
  assert.equal(splitFromTouch(100, 0, 0), 0.5);
  assert.equal(splitFromTouch(100, 0, Number.NaN), 0.5);
});

test('split clamps outside the frame instead of jumping', () => {
  assert.equal(splitFromTouch(-500, 40, 200), MIN_SPLIT);
  assert.equal(splitFromTouch(9999, 40, 200), MAX_SPLIT);
});

test('zoom clamps to the supported range', () => {
  assert.equal(clampZoom(0.2), MIN_ZOOM);
  assert.equal(clampZoom(50), MAX_ZOOM);
  assert.equal(clampZoom(2), 2);
});

test('an unzoomed image cannot be panned', () => {
  assert.equal(maxPanOffset(300, 1), 0);
  assert.deepEqual(clampPan({ x: 120, y: -80 }, { width: 300, height: 400 }, 1), { x: 0, y: 0 });
});

test('a zoomed image pans only within its overflow', () => {
  // 300px wide at 2x overflows by 300px, so it can move 150px each way.
  assert.equal(maxPanOffset(300, 2), 150);
  assert.deepEqual(clampPan({ x: 400, y: -900 }, { width: 300, height: 400 }, 2), {
    x: 150,
    y: -200,
  });
  assert.deepEqual(clampPan({ x: 20, y: 30 }, { width: 300, height: 400 }, 2), { x: 20, y: 30 });
});

test('double tap toggles between fit and zoomed', () => {
  assert.equal(nextDoubleTapZoom(1), DOUBLE_TAP_ZOOM);
  assert.equal(nextDoubleTapZoom(2.5), MIN_ZOOM);
  assert.equal(nextDoubleTapZoom(MAX_ZOOM), MIN_ZOOM);
});
