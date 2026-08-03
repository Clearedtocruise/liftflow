/**
 * Only claim a video exists when the exercise has a real web URL.
 *
 * Empty strings and placeholder values in imported exercise data used to be enough for media-like
 * UI to appear. Written steps are always available; the video action is strictly opt-in.
 */
export function isUsableTutorialUrl(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;

  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && Boolean(url.hostname);
  } catch {
    return false;
  }
}
