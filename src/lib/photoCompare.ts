/**
 * Pure geometry for the before/after compare slider and the pinch-zoom viewer.
 *
 * Kept out of the components so the drag math can be tested: the original slider divided an
 * absolute screen X by the frame width, and captured `width` at 0 in a `useRef` PanResponder,
 * so the handle never tracked the finger.
 */

export const MIN_SPLIT = 0.02;
export const MAX_SPLIT = 0.98;

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 5;
/** Double-tap toggles between fit and this. */
export const DOUBLE_TAP_ZOOM = 2.5;

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  const clamped = Math.min(max, Math.max(min, value));
  // Normalize -0, which reads as a negative offset to callers comparing against 0.
  return clamped === 0 ? 0 : clamped;
}

/**
 * Split position from a touch, in coordinates relative to the frame's left edge.
 * `frameX` is the frame's absolute X so an absolute page/move X can be passed straight in.
 */
export function splitFromTouch(touchX: number, frameX: number, frameWidth: number): number {
  if (!Number.isFinite(frameWidth) || frameWidth <= 0) return 0.5;
  return clamp((touchX - frameX) / frameWidth, MIN_SPLIT, MAX_SPLIT);
}

export function clampZoom(scale: number): number {
  return clamp(scale, MIN_ZOOM, MAX_ZOOM);
}

/**
 * Maximum pan offset for a zoomed image, so it can never be dragged off screen.
 * At scale 1 the image exactly fits, so there is nothing to pan.
 */
export function maxPanOffset(containerSize: number, scale: number): number {
  if (!Number.isFinite(containerSize) || containerSize <= 0) return 0;
  const overflow = containerSize * (clampZoom(scale) - 1);
  return Math.max(0, overflow / 2);
}

export function clampPan(
  offset: { x: number; y: number },
  container: { width: number; height: number },
  scale: number,
): { x: number; y: number } {
  const maxX = maxPanOffset(container.width, scale);
  const maxY = maxPanOffset(container.height, scale);
  return {
    x: clamp(offset.x, -maxX, maxX),
    y: clamp(offset.y, -maxY, maxY),
  };
}

/** Double-tap zooms in when near fit, otherwise returns to fit. */
export function nextDoubleTapZoom(currentScale: number): number {
  return currentScale > MIN_ZOOM + 0.01 ? MIN_ZOOM : DOUBLE_TAP_ZOOM;
}
